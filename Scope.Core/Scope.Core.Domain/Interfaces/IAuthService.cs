using Scope.Core.Domain.Models;

namespace Scope.Core.Domain.Interfaces;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string username, string email, string password, string displayName, DateOnly? dateOfBirth, string? phoneNumber = null, CancellationToken cancellationToken = default);
    Task<AuthOutcome> LoginAsync(string identifier, string password, string? mfaCode = null, CancellationToken cancellationToken = default);
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<UserProfile> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
