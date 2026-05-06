using System.Security.Cryptography;
using System.Text;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Scope.Core.Infrastructure.Services;

// Classical double-submit password reset:
//   1. Client calls `RequestResetAsync(email)`. We never confirm whether the
//      email exists. If it does we generate a cryptographically-random token,
//      persist its SHA-256 hash, and publish a `user.password_reset_requested`
//      Kafka event so the Content/Intel services can dispatch the email.
//   2. Client follows the email link and POSTs {token, newPassword}. We hash
//      the token, locate the record, enforce expiry + single-use + policy,
//      swap the password hash, and revoke every outstanding refresh token
//      so existing sessions on other devices cannot outlive a credential
//      reset (required by NIST 800-63B / PCI 8.2.4).
public sealed class PasswordResetService(
    CoreDbContext dbContext,
    IPasswordHasher passwordHasher,
    IPasswordPolicy passwordPolicy,
    IPasswordBreachChecker breachChecker,
    IKafkaProducerService kafkaProducerService,
    ILogger<PasswordResetService>? logger = null) : IPasswordResetService
{
    private static readonly EventId AuditEvent = new(9002, "scope.security.audit");
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);
    // Stops attackers from using the endpoint to enumerate accounts: only
    // generate a fresh token if the most recent outstanding one is older
    // than this window, otherwise reuse / ignore silently.
    private static readonly TimeSpan ThrottleWindow = TimeSpan.FromMinutes(2);

    public async Task RequestResetAsync(string email, string? requestIp, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            Audit("password_reset_request", "denied", null, "empty_email");
            return;
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.IsActive, cancellationToken);
        if (user is null)
        {
            Audit("password_reset_request", "skipped", null, "unknown_email", email);
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var recent = await dbContext.PasswordResets
            .Where(x => x.UserId == user.Id && x.ConsumedAt == null && x.CreatedAt > now - ThrottleWindow)
            .AnyAsync(cancellationToken);
        if (recent)
        {
            Audit("password_reset_request", "throttled", user.Id.ToString());
            return;
        }

        var plaintext = NewToken();
        var record = new PasswordReset
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = Sha256Hex(plaintext),
            CreatedAt = now,
            ExpiresAt = now.Add(TokenLifetime),
            RequestIpHash = string.IsNullOrWhiteSpace(requestIp) ? null : Sha256Hex(requestIp!),
        };
        dbContext.PasswordResets.Add(record);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Do not log the token. The Kafka event is considered a privileged
        // internal channel consumed by the email dispatcher.
        await kafkaProducerService.PublishAsync(
            "user.password_reset_requested",
            new
            {
                userId = user.Id,
                email = user.Email,
                displayName = user.DisplayName,
                token = plaintext,
                expiresAt = record.ExpiresAt,
            },
            cancellationToken);

        Audit("password_reset_request", "success", user.Id.ToString());
    }

    public async Task CompleteResetAsync(string token, string newPassword, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(newPassword))
        {
            Audit("password_reset_complete", "failure", null, "empty_input");
            throw new ValidationException("Invalid reset request", [("token", "Token and new password are required.")]);
        }

        var hashed = Sha256Hex(token);
        var record = await dbContext.PasswordResets
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.TokenHash == hashed, cancellationToken);
        if (record is null || record.ConsumedAt is not null || record.ExpiresAt < DateTimeOffset.UtcNow)
        {
            Audit("password_reset_complete", "failure", record?.UserId.ToString(), "invalid_or_expired");
            throw new UnauthorizedException("Invalid or expired reset token");
        }

        var user = record.User;
        var policy = passwordPolicy.Validate(newPassword, user.Username, user.Email);
        if (!policy.IsValid)
        {
            Audit("password_reset_complete", "denied", user.Id.ToString(), "weak_password");
            throw new ValidationException("Password does not meet policy", [("password", policy.Reason ?? "Password is too weak.")]);
        }
        if (await breachChecker.IsBreachedAsync(newPassword, cancellationToken))
        {
            Audit("password_reset_complete", "denied", user.Id.ToString(), "breached_password");
            throw new ValidationException("Password does not meet policy", [("password", "This password has appeared in a known data breach.")]);
        }

        user.PasswordHash = passwordHasher.Hash(newPassword);
        user.UpdatedAt = DateTimeOffset.UtcNow;
        user.FailedLoginAttempts = 0;
        user.LockoutUntil = null;
        record.ConsumedAt = DateTimeOffset.UtcNow;

        // Invalidate every live refresh token for this user so stolen sessions
        // cannot continue past a credential rotation.
        await dbContext.RefreshTokens
            .Where(x => x.UserId == user.Id && x.RevokedAt == null)
            .ExecuteUpdateAsync(
                s => s.SetProperty(t => t.RevokedAt, _ => DateTimeOffset.UtcNow)
                      .SetProperty(t => t.RevokedReason, _ => "password_reset"),
                cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        await kafkaProducerService.PublishAsync(
            "user.password_reset_completed",
            new { userId = user.Id, email = user.Email },
            cancellationToken);

        Audit("password_reset_complete", "success", user.Id.ToString());
    }

    private static string NewToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    internal static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }

    private void Audit(string eventName, string outcome, string? userId, string? reason = null, string? email = null)
    {
        logger?.Log(
            outcome == "success" ? LogLevel.Information : LogLevel.Warning,
            AuditEvent,
            "security_audit event={Event} outcome={Outcome} userId={UserId} reason={Reason} email={EmailHash}",
            eventName,
            outcome,
            userId ?? "anonymous",
            reason ?? "-",
            email is null ? "-" : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(email.Trim().ToLowerInvariant())))[..12]);
    }
}
