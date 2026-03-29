using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Data;
using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace Atlas.Core.Infrastructure.Services;

public sealed class PasswordHasherService : IPasswordHasher
{
    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password);

    public bool Verify(string password, string passwordHash) => BCrypt.Net.BCrypt.Verify(password, passwordHash);
}

public sealed class JwtTokenService(IConfiguration configuration) : IJwtTokenService
{
    public TokenPair CreateTokens(User user)
    {
        var secret = configuration["CORE_JWT_SECRET"] ?? "development-secret-development-secret";
        var issuer = configuration["CORE_JWT_ISSUER"] ?? "atlas-core";
        var audience = configuration["CORE_JWT_AUDIENCE"] ?? "atlas-frontend";
        var expirationMinutes = int.TryParse(configuration["CORE_JWT_EXPIRATION_MINUTES"], out var minutes) ? minutes : 15;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddMinutes(expirationMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("name", user.DisplayName),
            new("roles", user.Role),
            new(ClaimTypes.Role, user.Role),
            new(JwtRegisteredClaimNames.Iat, now.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            now.UtcDateTime,
            expires.UtcDateTime,
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        return new TokenPair(accessToken, refreshToken, expires);
    }
}

public sealed class KafkaProducerService(IConfiguration configuration, ILogger<KafkaProducerService> logger) : IKafkaProducerService
{
    public async Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default)
    {
        var bootstrap = configuration["KAFKA_BOOTSTRAP_SERVERS"];
        if (string.IsNullOrWhiteSpace(bootstrap))
        {
            logger.LogInformation("Kafka bootstrap not configured; skipped topic {Topic}", topic);
            return;
        }

        using var producer = new ProducerBuilder<string, string>(new ProducerConfig { BootstrapServers = bootstrap }).Build();
        var body = JsonSerializer.Serialize(payload);
        await producer.ProduceAsync(topic, new Message<string, string> { Key = Guid.NewGuid().ToString(), Value = body }, cancellationToken);
        logger.LogInformation("Produced Kafka event to {Topic}", topic);
    }
}

public sealed class S3Service(IConfiguration configuration) : IAvatarStorageService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

    public async Task<string> SaveAvatarAsync(Guid userId, string fileName, string contentType, Stream content, CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            throw new ValidationException("Avatar must be a JPEG, PNG, or WebP image", [("file", "Unsupported file extension")]);
        }

        if (string.IsNullOrWhiteSpace(contentType) || !AllowedContentTypes.Contains(contentType))
        {
            throw new ValidationException("Avatar must be a JPEG, PNG, or WebP image", [("file", "Unsupported content type")]);
        }

        var mediaRoot = configuration["CORE_MEDIA_ROOT"] ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "media", "avatars");
        var userDirectory = Path.Combine(mediaRoot, userId.ToString("N"));
        Directory.CreateDirectory(userDirectory);

        var storedFileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var filePath = Path.Combine(userDirectory, storedFileName);

        await using var fileStream = File.Create(filePath);
        await content.CopyToAsync(fileStream, cancellationToken);

        return $"/media/avatars/{userId:N}/{storedFileName}";
    }
}

public sealed class AuthService(
    CoreDbContext dbContext,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IKafkaProducerService kafkaProducerService,
    IConfiguration configuration) : IAuthService
{
    private static readonly ConcurrentDictionary<string, PasswordResetTicket> PasswordResetTickets = new(StringComparer.Ordinal);

    public async Task<AuthResult> RegisterAsync(string username, string email, string password, string displayName, CancellationToken cancellationToken = default)
    {
        ValidateRegistration(username, email, password, displayName);

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var normalizedUsername = username.Trim();
        var exists = await dbContext.Users.AsNoTracking()
            .AnyAsync(x => x.Email == normalizedEmail || x.Username == normalizedUsername, cancellationToken);
        if (exists)
        {
            throw new ConflictException("User already exists");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = normalizedUsername,
            Email = normalizedEmail,
            DisplayName = displayName.Trim(),
            PasswordHash = passwordHasher.Hash(password),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            Role = "user"
        };

        var tokenPair = jwtTokenService.CreateTokens(user);
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.Add(CreateRefreshToken(user.Id, tokenPair.RefreshToken));
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("user.registered", new { user.Id, user.Username, user.Email }, cancellationToken);

        return ToAuthResult(user, tokenPair);
    }

    public async Task<AuthResult> LoginAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            throw new ValidationException("Invalid input data", [("email", "Email and password are required")]);
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.IsActive, cancellationToken)
            ?? throw new UnauthorizedException("Invalid credentials");

        if (!passwordHasher.Verify(password, user.PasswordHash))
        {
            throw new UnauthorizedException("Invalid credentials");
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        var tokenPair = jwtTokenService.CreateTokens(user);
        dbContext.RefreshTokens.Add(CreateRefreshToken(user.Id, tokenPair.RefreshToken));
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToAuthResult(user, tokenPair);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            throw new ValidationException("Invalid input data", [("refreshToken", "Refresh token is required")]);
        }

        var stored = await dbContext.RefreshTokens
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.Token == refreshToken && x.RevokedAt == null, cancellationToken)
            ?? throw new UnauthorizedException("Invalid refresh token");

        if (stored.ExpiresAt < DateTimeOffset.UtcNow)
        {
            throw new UnauthorizedException("Refresh token expired");
        }

        stored.RevokedAt = DateTimeOffset.UtcNow;
        stored.User.UpdatedAt = DateTimeOffset.UtcNow;

        var tokenPair = jwtTokenService.CreateTokens(stored.User);
        dbContext.RefreshTokens.Add(CreateRefreshToken(stored.UserId, tokenPair.RefreshToken));
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToAuthResult(stored.User, tokenPair);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return;
        }

        var stored = await dbContext.RefreshTokens.FirstOrDefaultAsync(x => x.Token == refreshToken && x.RevokedAt == null, cancellationToken);
        if (stored is null)
        {
            return;
        }

        stored.RevokedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ForgotPasswordAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ValidationException("Invalid input data", [("email", "Email is required")]);
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.IsActive, cancellationToken);
        if (user is null)
        {
            return;
        }

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        PasswordResetTickets[token] = new PasswordResetTicket(user.Id, DateTimeOffset.UtcNow.AddHours(1));
    }

    public async Task ResetPasswordAsync(string token, string password, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(password))
        {
            throw new ValidationException("Invalid input data", [("token", "Token and password are required")]);
        }

        if (!PasswordResetTickets.TryRemove(token, out var ticket) || ticket.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            throw new UnauthorizedException("Invalid reset token");
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == ticket.UserId && x.IsActive, cancellationToken)
            ?? throw new NotFoundException("User not found");

        user.PasswordHash = passwordHasher.Hash(password);
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var activeTokens = await dbContext.RefreshTokens.Where(x => x.UserId == user.Id && x.RevokedAt == null).ToListAsync(cancellationToken);
        foreach (var refreshToken in activeTokens)
        {
            refreshToken.RevokedAt = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<AuthResult> LoginWithCognitoAsync(string email, string? username, string? displayName, string? subject, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ValidationException("Invalid input data", [("email", "Email is required")]);
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.IsActive, cancellationToken);
        if (user is null)
        {
            var desiredUsername = string.IsNullOrWhiteSpace(username)
                ? BuildUsernameFromEmail(normalizedEmail)
                : username.Trim();

            user = new User
            {
                Id = Guid.NewGuid(),
                Username = await EnsureUniqueUsernameAsync(desiredUsername, cancellationToken),
                Email = normalizedEmail,
                DisplayName = string.IsNullOrWhiteSpace(displayName) ? desiredUsername : displayName.Trim(),
                PasswordHash = passwordHasher.Hash(subject ?? Guid.NewGuid().ToString("N")),
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
                Role = "user"
            };

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);
            await kafkaProducerService.PublishAsync("user.registered", new { user.Id, user.Username, user.Email }, cancellationToken);
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        var tokenPair = jwtTokenService.CreateTokens(user);
        dbContext.RefreshTokens.Add(CreateRefreshToken(user.Id, tokenPair.RefreshToken));
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToAuthResult(user, tokenPair);
    }

    public async Task<UserProfile> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await dbContext.Users.AsNoTracking()
                   .Where(x => x.Id == userId && x.IsActive)
                   .Select(x => new UserProfile(x.Id, x.Username, x.Email, x.DisplayName, x.Bio, x.AvatarUrl, x.CreatedAt))
                   .FirstOrDefaultAsync(cancellationToken)
               ?? throw new NotFoundException("User not found");
    }

    private static void ValidateRegistration(string username, string email, string password, string displayName)
    {
        var validationErrors = new List<(string Field, string Message)>();

        if (string.IsNullOrWhiteSpace(username)) validationErrors.Add(("username", "Username is required"));
        if (string.IsNullOrWhiteSpace(email)) validationErrors.Add(("email", "Email is required"));
        if (string.IsNullOrWhiteSpace(password)) validationErrors.Add(("password", "Password is required"));
        if (string.IsNullOrWhiteSpace(displayName)) validationErrors.Add(("displayName", "Display name is required"));

        if (validationErrors.Count > 0)
        {
            throw new ValidationException("Invalid input data", validationErrors);
        }
    }

    private RefreshToken CreateRefreshToken(Guid userId, string refreshToken)
        => new()
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = refreshToken,
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(GetRefreshTokenLifetimeDays())
        };

    private int GetRefreshTokenLifetimeDays()
        => int.TryParse(configuration["CORE_REFRESH_TOKEN_DAYS"], out var days) ? days : 7;

    private static AuthResult ToAuthResult(User user, TokenPair tokenPair)
        => new(user.Id, user.Username, user.Email, user.DisplayName, tokenPair.AccessToken, tokenPair.RefreshToken);

    private async Task<string> EnsureUniqueUsernameAsync(string desiredUsername, CancellationToken cancellationToken)
    {
        var candidate = NormalizeUsername(desiredUsername);
        if (string.IsNullOrWhiteSpace(candidate))
        {
            candidate = $"user{RandomNumberGenerator.GetInt32(100000, 999999)}";
        }

        var suffix = 0;
        var uniqueCandidate = candidate;
        while (await dbContext.Users.AsNoTracking().AnyAsync(x => x.Username == uniqueCandidate, cancellationToken))
        {
            suffix++;
            uniqueCandidate = $"{candidate}{suffix}";
        }

        return uniqueCandidate;
    }

    private static string BuildUsernameFromEmail(string email)
    {
        var localPart = email.Split('@', 2, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "user";
        return NormalizeUsername(localPart);
    }

    private static string NormalizeUsername(string value)
    {
        var cleanedValue = Regex.Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9._-]", string.Empty);
        return cleanedValue.Length > 50 ? cleanedValue[..50] : cleanedValue;
    }

    private sealed record PasswordResetTicket(Guid UserId, DateTimeOffset ExpiresAt);
}
