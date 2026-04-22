using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
        var secret = configuration["CORE_JWT_SECRET"] ?? throw new InvalidOperationException("Missing CORE_JWT_SECRET");
        var issuer = configuration["CORE_JWT_ISSUER"] ?? "atlas-core";
        var audience = configuration["CORE_JWT_AUDIENCE"] ?? "atlas-frontend";
        var expirationMinutes = int.TryParse(configuration["CORE_JWT_EXPIRATION_MINUTES"], out var minutes) ? minutes : 15;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddMinutes(expirationMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new("name", user.DisplayName),
            new(ClaimTypes.Role, user.Role)
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

public sealed class KafkaProducerService : IKafkaProducerService, IDisposable
{
    private readonly string? bootstrapServers;
    private readonly ILogger<KafkaProducerService> logger;
    private readonly Lazy<IProducer<string, string>?> producer;

    public KafkaProducerService(IConfiguration configuration, ILogger<KafkaProducerService> logger)
    {
        this.logger = logger;
        bootstrapServers = configuration["KAFKA_BOOTSTRAP_SERVERS"];
        producer = new Lazy<IProducer<string, string>?>(BuildProducer, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public async Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default)
    {
        var activeProducer = producer.Value;
        if (activeProducer is null)
        {
            logger.LogInformation("Kafka bootstrap not configured; skipped topic {Topic}", topic);
            return;
        }

        var body = JsonSerializer.Serialize(payload);
        await activeProducer.ProduceAsync(topic, new Message<string, string> { Key = Guid.NewGuid().ToString(), Value = body }, cancellationToken);
        logger.LogInformation("Produced Kafka event to {Topic}", topic);
    }

    public void Dispose()
    {
        if (producer.IsValueCreated)
        {
            producer.Value?.Dispose();
        }
    }

    private IProducer<string, string>? BuildProducer()
    {
        if (string.IsNullOrWhiteSpace(bootstrapServers))
        {
            return null;
        }

        return new ProducerBuilder<string, string>(new ProducerConfig { BootstrapServers = bootstrapServers }).Build();
    }
}

public sealed class AuthService(CoreDbContext dbContext, IPasswordHasher passwordHasher, IJwtTokenService jwtTokenService, IKafkaProducerService kafkaProducerService) : IAuthService
{
    public async Task<AuthResult> RegisterAsync(string username, string email, string password, string displayName, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            throw new ValidationException("Invalid input data", [ ("username", "Username, email, and password are required") ]);
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var exists = await dbContext.Users.AsNoTracking().AnyAsync(x => x.Email == normalizedEmail || x.Username == username, cancellationToken);
        if (exists) throw new ConflictException("User already exists");

        var user = new User
        {
            Id = Guid.NewGuid(), Username = username.Trim(), Email = normalizedEmail, DisplayName = displayName.Trim(), PasswordHash = passwordHasher.Hash(password), CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        };
        var tokenPair = jwtTokenService.CreateTokens(user);
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UserId = user.Id, Token = tokenPair.RefreshToken, CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) });
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("user.registered", new { user.Id, user.Username, user.Email }, cancellationToken);
        return new AuthResult(user.Id, user.Username, user.Email, user.DisplayName, tokenPair.AccessToken, tokenPair.RefreshToken);
    }

    public async Task<AuthResult> LoginAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.IsActive, cancellationToken) ?? throw new UnauthorizedException("Invalid credentials");
        if (!passwordHasher.Verify(password, user.PasswordHash)) throw new UnauthorizedException("Invalid credentials");
        user.LastLoginAt = DateTimeOffset.UtcNow;
        var tokenPair = jwtTokenService.CreateTokens(user);
        dbContext.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UserId = user.Id, Token = tokenPair.RefreshToken, CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) });
        await dbContext.SaveChangesAsync(cancellationToken);
        return new AuthResult(user.Id, user.Username, user.Email, user.DisplayName, tokenPair.AccessToken, tokenPair.RefreshToken);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var stored = await dbContext.RefreshTokens.Include(x => x.User).FirstOrDefaultAsync(x => x.Token == refreshToken && x.RevokedAt == null, cancellationToken) ?? throw new UnauthorizedException("Invalid refresh token");
        if (stored.ExpiresAt < DateTimeOffset.UtcNow) throw new UnauthorizedException("Refresh token expired");
        stored.RevokedAt = DateTimeOffset.UtcNow;
        var tokenPair = jwtTokenService.CreateTokens(stored.User);
        dbContext.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UserId = stored.UserId, Token = tokenPair.RefreshToken, CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddDays(7) });
        await dbContext.SaveChangesAsync(cancellationToken);
        return new AuthResult(stored.User.Id, stored.User.Username, stored.User.Email, stored.User.DisplayName, tokenPair.AccessToken, tokenPair.RefreshToken);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var stored = await dbContext.RefreshTokens.FirstOrDefaultAsync(x => x.Token == refreshToken && x.RevokedAt == null, cancellationToken);
        if (stored is null) return;
        stored.RevokedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<UserProfile> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.AsNoTracking().Where(x => x.Id == userId && x.IsActive).Select(x => new UserProfile(x.Id, x.Username, x.Email, x.DisplayName, x.Bio, x.AvatarUrl, x.CreatedAt)).FirstOrDefaultAsync(cancellationToken) ?? throw new NotFoundException("User not found");
        return user;
    }
}
