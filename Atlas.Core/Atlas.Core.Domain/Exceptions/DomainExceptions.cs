namespace Atlas.Core.Domain.Exceptions;

public class AtlasException : Exception
{
    public AtlasException(string code, string message, int statusCode = 400, IReadOnlyList<(string Field, string Message)>? details = null) : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Details = details ?? Array.Empty<(string Field, string Message)>();
    }

    public string Code { get; }
    public int StatusCode { get; }
    public IReadOnlyList<(string Field, string Message)> Details { get; }
}

public sealed class NotFoundException(string message) : AtlasException("NOT_FOUND", message, 404);
public sealed class UnauthorizedException(string message) : AtlasException("UNAUTHORIZED", message, 401);
public sealed class ConflictException(string message) : AtlasException("CONFLICT", message, 409);
public sealed class ValidationException(string message, IReadOnlyList<(string Field, string Message)> details) : AtlasException("VALIDATION_ERROR", message, 400, details);
public sealed class UnprocessableException(string message) : AtlasException("UNPROCESSABLE", message, 422);
