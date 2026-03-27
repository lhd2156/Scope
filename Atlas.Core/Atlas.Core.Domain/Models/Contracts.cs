namespace Atlas.Core.Domain.Models;

public sealed record ApiResponse<T>(T Data, object? Meta = null);
public sealed record ErrorEnvelope(ErrorBody Error);
public sealed record ErrorBody(string Code, string Message, IReadOnlyList<ErrorDetail> Details, string TraceId);
public sealed record ErrorDetail(string Field, string Message);
public sealed record TokenPair(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt);
public sealed record AuthResult(Guid Id, string Username, string Email, string DisplayName, string AccessToken, string RefreshToken);
public sealed record UserProfile(Guid Id, string Username, string Email, string DisplayName, string? Bio, string? AvatarUrl, DateTimeOffset CreatedAt);
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);
