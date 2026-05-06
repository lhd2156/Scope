namespace Scope.Core.Domain.Exceptions;

public class ScopeException : Exception
{
    public ScopeException(string code, string message, int statusCode = 400, IReadOnlyList<(string Field, string Message)>? details = null) : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Details = details ?? Array.Empty<(string Field, string Message)>();
    }

    public string Code { get; }
    public int StatusCode { get; }
    public IReadOnlyList<(string Field, string Message)> Details { get; }
}

public sealed class NotFoundException(string message) : ScopeException("NOT_FOUND", message, 404);
public sealed class UnauthorizedException(string message) : ScopeException("UNAUTHORIZED", message, 401);
public sealed class ConflictException(string message) : ScopeException("CONFLICT", message, 409);
public sealed class ValidationException(string message, IReadOnlyList<(string Field, string Message)> details) : ScopeException("VALIDATION_ERROR", message, 400, details);
