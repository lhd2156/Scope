namespace Scope.Core.Domain.Models;

public sealed record ApiResponse<T>(T Data, object? Meta = null);
public sealed record ErrorEnvelope(ErrorBody Error);
public sealed record ErrorBody(string Code, string Message, IReadOnlyList<ErrorDetail> Details, string TraceId);
public sealed record ErrorDetail(string Field, string Message);
public sealed record TokenPair(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
public sealed record AuthResult(Guid Id, string Username, string Email, string DisplayName, string AccessToken, string RefreshToken);
public sealed record UserProfile(Guid Id, string Username, string Email, string DisplayName, string? Bio, string? AvatarUrl, DateTimeOffset CreatedAt);

// Login can return either a fully-authenticated session or an "MFA required"
// step-up state where the client must collect a code and retry. Keeping both
// in a single discriminated result keeps the controller simple.
public sealed record AuthOutcome(AuthResult? Result, bool MfaRequired)
{
    public static AuthOutcome Authenticated(AuthResult result) => new(result, false);
    public static AuthOutcome StepUpRequired() => new(null, true);
}
