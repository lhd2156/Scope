using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Models;

namespace Atlas.Core.Domain.Interfaces;

public interface IJwtTokenService
{
    TokenPair CreateTokens(User user);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string passwordHash);
}

public interface IKafkaProducerService
{
    Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default);
}

public interface IKafkaHealthCheckService
{
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
}

public interface IAvatarStorageService
{
    Task<string> SaveAvatarAsync(Guid userId, string fileName, string contentType, Stream content, CancellationToken cancellationToken = default);
}

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string username, string email, string password, string displayName, CancellationToken cancellationToken = default);
    Task<AuthResult> LoginAsync(string email, string password, CancellationToken cancellationToken = default);
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task ForgotPasswordAsync(string email, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(string token, string password, CancellationToken cancellationToken = default);
    Task<AuthResult> LoginWithCognitoAsync(string email, string? username, string? displayName, string? subject, CancellationToken cancellationToken = default);
    Task<UserProfile> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
