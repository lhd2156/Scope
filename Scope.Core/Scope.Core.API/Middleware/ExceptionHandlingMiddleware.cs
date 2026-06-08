using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Models;
using Microsoft.Extensions.Logging;

namespace Scope.Core.API.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public const int ClientClosedRequestStatusCode = 499;

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
        catch (OperationCanceledException exception) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogDebug(exception, "Request was canceled by the client");
            MarkClientClosed(context);
        }
        catch (BadHttpRequestException exception) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogDebug(exception, "Request body ended after the client disconnected");
            MarkClientClosed(context);
        }
        catch (BadHttpRequestException exception)
        {
            logger.LogWarning(exception, "Rejected malformed HTTP request");
            await WriteAsync(context, StatusCodes.Status400BadRequest, "BAD_REQUEST", "Malformed or incomplete request", []);
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

    private static void MarkClientClosed(HttpContext context)
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = ClientClosedRequestStatusCode;
        }
    }
}
