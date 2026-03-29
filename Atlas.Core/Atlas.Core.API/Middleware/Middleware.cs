using System.Collections.Concurrent;
using System.Diagnostics;
using Atlas.Core.Domain.Constants;
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
    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> requests = new();
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    private static readonly PathString AuthPrefix = new("/api/core/auth");

    public async Task InvokeAsync(HttpContext context)
    {
        var clientKey = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var now = DateTimeOffset.UtcNow;

        if (!TryConsume($"global:{clientKey}", now, CoreLimits.GlobalRequestsPerMinute, out var retryAfterSeconds))
        {
            await WriteRateLimitedResponseAsync(context, retryAfterSeconds);
            return;
        }

        if (context.Request.Path.StartsWithSegments(AuthPrefix)
            && !TryConsume($"auth:{clientKey}", now, CoreLimits.AuthRequestsPerMinute, out retryAfterSeconds))
        {
            await WriteRateLimitedResponseAsync(context, retryAfterSeconds);
            return;
        }

        await next(context);
    }

    private bool TryConsume(string bucketKey, DateTimeOffset now, int limit, out int retryAfterSeconds)
    {
        var queue = requests.GetOrAdd(bucketKey, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() >= Window)
            {
                queue.Dequeue();
            }

            if (queue.Count >= limit)
            {
                var retryAfter = queue.Peek().Add(Window) - now;
                retryAfterSeconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
                return false;
            }

            queue.Enqueue(now);
            retryAfterSeconds = 0;
            return true;
        }
    }

    private static async Task WriteRateLimitedResponseAsync(HttpContext context, int retryAfterSeconds)
    {
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.ContentType = "application/json";
        context.Response.Headers["Retry-After"] = retryAfterSeconds.ToString();
        await context.Response.WriteAsJsonAsync(new ErrorEnvelope(new ErrorBody("RATE_LIMITED", "Too many requests", [], context.TraceIdentifier)));
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
