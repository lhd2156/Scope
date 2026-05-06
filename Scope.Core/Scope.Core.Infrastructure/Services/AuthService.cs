using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Configuration;
using Scope.Core.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Scope.Core.Infrastructure.Services;

public sealed class AuthService(
    CoreDbContext dbContext,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IKafkaProducerService kafkaProducerService,
    IOptions<JwtOptions> jwtOptions,
    IPasswordPolicy passwordPolicy,
    IPasswordBreachChecker breachChecker,
    IMfaService mfaService,
    ILogger<AuthService>? logger = null) : IAuthService
{
    // Structured audit log. Category is `scope.security.audit` so a SIEM (Datadog,
    // Splunk, OpenSearch) can filter security events separately from normal app
    // logs. Every line carries the event name, actor (user id or "anonymous"),
    // outcome, and a stable reason code. Never log raw passwords, tokens, or PII.
    private static readonly EventId AuditEvent = new(9001, "scope.security.audit");

    // A fixed BCrypt hash used to consume verification time on unknown-user
    // logins, so attackers cannot distinguish "user does not exist" from
    // "wrong password" via timing.
    private const string DummyPasswordHash = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Rg/P1C2Ln6zVWq4p0zW3Jw9yzR.xu";

    // Brute-force defense. After MaxFailedAttempts consecutive failed logins,
    // the account is locked for LockoutDuration. The counter resets on a
    // successful login. This pairs with the per-IP RateLimitMiddleware so a
    // single attacker can't exhaust multiple accounts either.
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private const int UsernameMinLength = 3;
    private const int UsernameMaxLength = 30;
    private const int DisplayNameMinLength = 2;
    private const int DisplayNameMaxLength = 60;
    private const int MinAgeYears = 13;
    private const int MaxAgeYears = 120;
    private const int PhoneDigitMinLength = 10;
    private const int PhoneDigitMaxLength = 15;
    private static readonly Regex UsernamePattern = new("^[A-Za-z0-9._-]+$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex DisplayNamePattern = new(@"^\p{L}[\p{L}\s'.-]*$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
    private static readonly Regex PhoneCandidatePattern = new(@"^\+?[0-9\s().-]+$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private readonly TimeSpan refreshTokenLifetime = TimeSpan.FromDays(jwtOptions.Value.RefreshTokenDays);

    public async Task<AuthResult> RegisterAsync(string username, string email, string password, string displayName, DateOnly? dateOfBirth, string? phoneNumber = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            Audit("register", "denied", null, "validation", email);
            throw new ValidationException("Invalid input data", [("username", "Username, email, and password are required")]);
        }

        var normalizedUsername = username.Trim();
        if (normalizedUsername.Length is < UsernameMinLength or > UsernameMaxLength || !UsernamePattern.IsMatch(normalizedUsername))
        {
            Audit("register", "denied", null, "invalid_username", email);
            throw new ValidationException("Invalid username", [("username", "Username can only contain letters, numbers, underscores, periods, or hyphens")]);
        }

        if (string.IsNullOrWhiteSpace(displayName))
        {
            Audit("register", "denied", null, "invalid_display_name", email);
            throw new ValidationException("Invalid display name", [("displayName", "Display name is required.")]);
        }

        var normalizedDisplayName = displayName.Trim();
        if (normalizedDisplayName.Length is < DisplayNameMinLength or > DisplayNameMaxLength || !DisplayNamePattern.IsMatch(normalizedDisplayName))
        {
            Audit("register", "denied", null, "invalid_display_name", email);
            throw new ValidationException("Invalid display name", [("displayName", "Display name must use letters, spaces, hyphens, apostrophes, or periods.")]);
        }

        var dateOfBirthError = ValidateDateOfBirth(dateOfBirth);
        if (dateOfBirthError is not null)
        {
            Audit("register", "denied", null, "invalid_date_of_birth", email);
            throw new ValidationException("Invalid date of birth", [("dateOfBirth", dateOfBirthError)]);
        }
        var validatedDateOfBirth = dateOfBirth!.Value;

        var policy = passwordPolicy.Validate(password, normalizedUsername, email);
        if (!policy.IsValid)
        {
            Audit("register", "denied", null, "weak_password", email);
            throw new ValidationException("Password does not meet policy", [("password", policy.Reason ?? "Password is too weak.")]);
        }

        // HIBP breach check (opt-in via config, fails open on network errors).
        if (await breachChecker.IsBreachedAsync(password, cancellationToken))
        {
            Audit("register", "denied", null, "breached_password", email);
            throw new ValidationException("Password does not meet policy", [("password", "This password has appeared in a known data breach. Please choose a different one.")]);
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedPhoneNumber = NormalizePhoneNumberForLookup(phoneNumber);
        if (!string.IsNullOrWhiteSpace(phoneNumber) && normalizedPhoneNumber is null)
        {
            Audit("register", "denied", null, "invalid_phone", email);
            throw new ValidationException("Invalid phone number", [("phoneNumber", $"Phone number must include {PhoneDigitMinLength} to {PhoneDigitMaxLength} digits.")]);
        }

        var exists = await dbContext.Users.AsNoTracking().AnyAsync(
            x => x.Email == normalizedEmail ||
                 x.Username == normalizedUsername ||
                 (normalizedPhoneNumber != null && x.PhoneNumber == normalizedPhoneNumber),
            cancellationToken);
        if (exists)
        {
            Audit("register", "denied", null, "duplicate", email);
            throw new ConflictException("User already exists");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = normalizedUsername,
            Email = normalizedEmail,
            PhoneNumber = normalizedPhoneNumber,
            DisplayName = normalizedDisplayName,
            DateOfBirth = validatedDateOfBirth,
            PasswordHash = passwordHasher.Hash(password),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        var tokenPair = jwtTokenService.CreateTokens(user);
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.Add(NewRefreshToken(user.Id, tokenPair.RefreshToken));
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("user.registered", new { user.Id, user.Username, user.Email }, cancellationToken);
        Audit("register", "success", user.Id.ToString(), null, email);
        return new AuthResult(user.Id, user.Username, user.Email, user.DisplayName, tokenPair.AccessToken, tokenPair.RefreshToken);
    }

    public async Task<AuthOutcome> LoginAsync(string identifier, string password, string? mfaCode = null, CancellationToken cancellationToken = default)
    {
        var normalizedIdentifier = identifier.Trim();
        var user = await FindActiveUserByIdentifierAsync(normalizedIdentifier, cancellationToken);
        if (user is null)
        {
            _ = passwordHasher.Verify(password, DummyPasswordHash);
            Audit("login", "failure", null, "unknown_user", identifier);
            throw new UnauthorizedException("Invalid credentials");
        }

        if (user.LockoutUntil is { } lockedUntil && lockedUntil > DateTimeOffset.UtcNow)
        {
            _ = passwordHasher.Verify(password, DummyPasswordHash);
            Audit("login", "failure", user.Id.ToString(), "locked_out", identifier);
            throw new UnauthorizedException("Account temporarily locked. Try again later.");
        }

        if (!passwordHasher.Verify(password, user.PasswordHash))
        {
            user.FailedLoginAttempts += 1;
            if (user.FailedLoginAttempts >= MaxFailedAttempts)
            {
                user.LockoutUntil = DateTimeOffset.UtcNow.Add(LockoutDuration);
                user.FailedLoginAttempts = 0;
                await dbContext.SaveChangesAsync(cancellationToken);
                Audit("login", "failure", user.Id.ToString(), "lockout_triggered", identifier);
                throw new UnauthorizedException("Account temporarily locked. Try again later.");
            }
            await dbContext.SaveChangesAsync(cancellationToken);
            Audit("login", "failure", user.Id.ToString(), "bad_password", identifier);
            throw new UnauthorizedException("Invalid credentials");
        }

        if (user.MfaEnabled)
        {
            if (string.IsNullOrWhiteSpace(mfaCode))
            {
                Audit("login", "step_up_required", user.Id.ToString(), "mfa_required", identifier);
                return AuthOutcome.StepUpRequired();
            }
            if (!await mfaService.ValidateAsync(user.Id, mfaCode, cancellationToken))
            {
                user.FailedLoginAttempts += 1;
                await dbContext.SaveChangesAsync(cancellationToken);
                Audit("login", "failure", user.Id.ToString(), "bad_mfa_code", identifier);
                throw new UnauthorizedException("Invalid MFA code");
            }
        }

        user.FailedLoginAttempts = 0;
        user.LockoutUntil = null;
        user.LastLoginAt = DateTimeOffset.UtcNow;
        var tokenPair = jwtTokenService.CreateTokens(user);
        dbContext.RefreshTokens.Add(NewRefreshToken(user.Id, tokenPair.RefreshToken));
        await dbContext.SaveChangesAsync(cancellationToken);
        Audit("login", "success", user.Id.ToString(), null, identifier);
        return AuthOutcome.Authenticated(new AuthResult(user.Id, user.Username, user.Email, user.DisplayName, tokenPair.AccessToken, tokenPair.RefreshToken));
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            Audit("token_refresh", "failure", null, "empty_token");
            throw new UnauthorizedException("Invalid refresh token");
        }
        var hashed = RefreshTokenHasher.Hash(refreshToken);
        var stored = await dbContext.RefreshTokens.Include(x => x.User).FirstOrDefaultAsync(x => x.Token == hashed, cancellationToken);
        if (stored is null)
        {
            Audit("token_refresh", "failure", null, "unknown_token");
            throw new UnauthorizedException("Invalid refresh token");
        }

        // Replay detection: if the token is already revoked, the presenter is
        // either an attacker replaying an old token or the legitimate user
        // from a stolen session. Either way we kill every active refresh for
        // that user to force a full re-login across devices.
        if (stored.RevokedAt is not null)
        {
            var active = dbContext.RefreshTokens.Where(x => x.UserId == stored.UserId && x.RevokedAt == null);
            await active.ExecuteUpdateAsync(
                s => s.SetProperty(t => t.RevokedAt, _ => DateTimeOffset.UtcNow)
                      .SetProperty(t => t.RevokedReason, _ => "replay_detected"),
                cancellationToken);
            Audit("token_refresh", "failure", stored.UserId.ToString(), "replay_detected");
            throw new UnauthorizedException("Invalid refresh token");
        }

        if (stored.ExpiresAt < DateTimeOffset.UtcNow)
        {
            stored.RevokedAt = DateTimeOffset.UtcNow;
            stored.RevokedReason = "expired";
            await dbContext.SaveChangesAsync(cancellationToken);
            Audit("token_refresh", "failure", stored.UserId.ToString(), "expired_token");
            throw new UnauthorizedException("Refresh token expired");
        }

        var tokenPair = jwtTokenService.CreateTokens(stored.User);
        var replacement = NewRefreshToken(stored.UserId, tokenPair.RefreshToken);
        stored.RevokedAt = DateTimeOffset.UtcNow;
        stored.RevokedReason = "rotated";
        stored.ReplacedByTokenHash = replacement.Token;
        dbContext.RefreshTokens.Add(replacement);
        await dbContext.SaveChangesAsync(cancellationToken);
        Audit("token_refresh", "success", stored.UserId.ToString());
        return new AuthResult(stored.User.Id, stored.User.Username, stored.User.Email, stored.User.DisplayName, tokenPair.AccessToken, tokenPair.RefreshToken);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken)) return;
        var hashed = RefreshTokenHasher.Hash(refreshToken);
        var stored = await dbContext.RefreshTokens.FirstOrDefaultAsync(x => x.Token == hashed && x.RevokedAt == null, cancellationToken);
        if (stored is null) return;
        stored.RevokedAt = DateTimeOffset.UtcNow;
        stored.RevokedReason = "logout";
        await dbContext.SaveChangesAsync(cancellationToken);
        Audit("logout", "success", stored.UserId.ToString());
    }

    public async Task<UserProfile> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.AsNoTracking()
            .Where(x => x.Id == userId && x.IsActive)
            .Select(x => new UserProfile(x.Id, x.Username, x.Email, x.DisplayName, x.Bio, x.AvatarUrl, x.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("User not found");
        return user;
    }

    private RefreshToken NewRefreshToken(Guid userId, string plaintextToken) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Token = RefreshTokenHasher.Hash(plaintextToken),
        CreatedAt = DateTimeOffset.UtcNow,
        ExpiresAt = DateTimeOffset.UtcNow.Add(refreshTokenLifetime),
    };

    private Task<User?> FindActiveUserByIdentifierAsync(string identifier, CancellationToken cancellationToken)
    {
        var normalizedIdentifier = identifier.Trim();
        var normalizedLower = normalizedIdentifier.ToLowerInvariant();
        var normalizedPhoneNumber = NormalizePhoneNumberForLookup(normalizedIdentifier);

        return dbContext.Users.FirstOrDefaultAsync(
            x => x.IsActive &&
                 (x.Email == normalizedLower ||
                  x.Username.ToLower() == normalizedLower ||
                  x.DisplayName.ToLower() == normalizedLower ||
                  (normalizedPhoneNumber != null && x.PhoneNumber == normalizedPhoneNumber)),
            cancellationToken);
    }

    private static string? NormalizePhoneNumberForLookup(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        if (!PhoneCandidatePattern.IsMatch(trimmed)) return null;

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.Length is < PhoneDigitMinLength or > PhoneDigitMaxLength) return null;

        return digits;
    }

    private static string? ValidateDateOfBirth(DateOnly? dateOfBirth)
    {
        if (dateOfBirth is null)
        {
            return "Date of birth is required.";
        }

        var birth = dateOfBirth.Value;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (birth > today)
        {
            return "Date of birth cannot be in the future.";
        }

        if (birth > today.AddYears(-MinAgeYears))
        {
            return $"You must be at least {MinAgeYears} years old to join Scope.";
        }

        if (birth < today.AddYears(-MaxAgeYears))
        {
            return "Date of birth looks too far back.";
        }

        return null;
    }

    private void Audit(string eventName, string outcome, string? userId, string? reason = null, string? identifier = null)
    {
        logger?.Log(
            outcome == "success" ? LogLevel.Information : LogLevel.Warning,
            AuditEvent,
            "security_audit event={Event} outcome={Outcome} userId={UserId} reason={Reason} identifier={IdentifierHash}",
            eventName,
            outcome,
            userId ?? "anonymous",
            reason ?? "-",
            identifier is null ? "-" : HashIdentifier(identifier));
    }

    private static string HashIdentifier(string identifier)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(identifier.Trim().ToLowerInvariant()));
        return Convert.ToHexString(bytes)[..12];
    }
}
