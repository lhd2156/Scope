namespace Scope.Core.Domain.Interfaces;

public readonly record struct MfaEnrollment(string Secret, string OtpAuthUri, IReadOnlyList<string> RecoveryCodes);

public interface IMfaService
{
    // Begin enrollment. Returns a shared secret + otpauth:// URI that the
    // client encodes as a QR code, plus a one-time list of recovery codes.
    // Enrollment is NOT complete until ConfirmAsync succeeds.
    Task<MfaEnrollment> StartEnrollmentAsync(Guid userId, CancellationToken cancellationToken = default);

    // Finalize enrollment by proving the user has the current TOTP code.
    Task ConfirmAsync(Guid userId, string code, CancellationToken cancellationToken = default);

    // Disable MFA for the current user. Requires a valid current code OR a
    // recovery code, same as login.
    Task DisableAsync(Guid userId, string code, CancellationToken cancellationToken = default);

    // Validate a TOTP or recovery code for the given user during login.
    Task<bool> ValidateAsync(Guid userId, string code, CancellationToken cancellationToken = default);
}
