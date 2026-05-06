namespace Scope.Core.Domain.Interfaces;

public interface IPasswordResetService
{
    // Always returns without throwing so the endpoint can safely avoid
    // leaking account-existence details to callers.
    Task RequestResetAsync(string email, string? requestIp, CancellationToken cancellationToken = default);

    Task CompleteResetAsync(string token, string newPassword, CancellationToken cancellationToken = default);
}
