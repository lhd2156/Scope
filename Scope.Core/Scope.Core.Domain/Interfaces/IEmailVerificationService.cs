namespace Scope.Core.Domain.Interfaces;

public interface IEmailVerificationService
{
    // Issue (or re-issue) an email-verification token for the authenticated
    // user. Always succeeds from the caller's perspective; internals throttle.
    Task SendAsync(Guid userId, CancellationToken cancellationToken = default);

    // Consume a verification token. Returns true if the account moved from
    // unverified -> verified, false for already-verified/no-op cases.
    Task<bool> ConfirmAsync(string token, CancellationToken cancellationToken = default);
}
