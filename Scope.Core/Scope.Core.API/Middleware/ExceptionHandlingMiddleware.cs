using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Models;
using Microsoft.Extensions.Logging;

namespace Scope.Core.API.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ScopeException exception)
        {
            logger.LogWarning(exception, "Handled Scope exception {Code}", exception.Code);
            await WriteAsync(context, exception.StatusCode, exception.Code, exception.Message, exception.Details.Select(x => new ErrorDetail(x.Field, x.Message)).ToArray());
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled exception");
            await WriteAsync(context, StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "Unexpected server error", []);
        }
    }

    private static async Task WriteAsync(HttpContext context, int statusCode, string code, string message, IReadOnlyList<ErrorDetail> details)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new ErrorEnvelope(new ErrorBody(code, message, details, context.TraceIdentifier)));
    }
}
