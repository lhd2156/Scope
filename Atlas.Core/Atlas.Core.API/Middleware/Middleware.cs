using System.Collections.Concurrent;
using System.Diagnostics;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Models;

namespace Atlas.Core.API.Middleware;

public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        await next(context);
        stopwatch.Stop();
        logger.LogInformation("HTTP {Method} {Path} => {StatusCode} in {DurationMs}ms", context.Request.Method, context.Request.Path, context.Response.StatusCode, stopwatch.ElapsedMilliseconds);
    }
}

public sealed class RateLimitMiddleware(RequestDelegate next)
{
    private static readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> Requests = new();
    private const int Limit = 100;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public async Task InvokeAsync(HttpContext context)
    {
        var key = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var now = DateTimeOffset.UtcNow;
        var queue = Requests.GetOrAdd(key, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() > Window) queue.Dequeue();
            if (queue.Count >= Limit)
            {
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.ContentType = "application/json";
                var body = System.Text.Json.JsonSerializer.Serialize(new ErrorEnvelope(new ErrorBody("RATE_LIMITED", "Too many requests", [], context.TraceIdentifier)));
                context.Response.WriteAsync(body).GetAwaiter().GetResult();
                return;
            }
            queue.Enqueue(now);
        }
        await next(context);
    }
}

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AtlasException exception)
        {
            logger.LogWarning(exception, "Handled Atlas exception {Code}", exception.Code);
            await WriteAsync(context, exception.StatusCode, exception.Code, exception.Message, exception.Details.Select(x => new ErrorDetail(x.Field, x.Message)).ToArray());
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled exception");
            await WriteAsync(context, 500, "INTERNAL_ERROR", "Unexpected server error", []);
        }
    }

    private static async Task WriteAsync(HttpContext context, int statusCode, string code, string message, IReadOnlyList<ErrorDetail> details)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new ErrorEnvelope(new ErrorBody(code, message, details, context.TraceIdentifier)));
    }
}
