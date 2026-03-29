using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.ExceptionServices;
using System.Text.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Models;
using Serilog.Context;

namespace Atlas.Core.API.Middleware;

public static class ApiErrorResponseWriter
{
    public static bool TryMapStatusCode(int statusCode, out string code, out string message)
    {
        (code, message) = statusCode switch
        {
            StatusCodes.Status400BadRequest => ("VALIDATION_ERROR", "Invalid input data"),
            StatusCodes.Status401Unauthorized => ("UNAUTHORIZED", "Missing or expired token"),
            StatusCodes.Status403Forbidden => ("FORBIDDEN", "Insufficient permissions"),
            StatusCodes.Status404NotFound => ("NOT_FOUND", "Resource does not exist"),
            StatusCodes.Status409Conflict => ("CONFLICT", "Duplicate resource"),
            StatusCodes.Status422UnprocessableEntity => ("UNPROCESSABLE", "Business rule violation"),
            StatusCodes.Status429TooManyRequests => ("RATE_LIMITED", "Too many requests"),
            StatusCodes.Status500InternalServerError => ("INTERNAL_ERROR", "Unexpected server error"),
            _ => (string.Empty, string.Empty)
        };

        return !string.IsNullOrWhiteSpace(code);
    }

    public static Task WriteAsync(HttpContext context, int statusCode, string code, string message, IReadOnlyList<ErrorDetail>? details = null)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsJsonAsync(new ErrorEnvelope(new ErrorBody(code, message, details ?? [], context.TraceIdentifier)));
    }
}

public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(context);
        context.TraceIdentifier = correlationId;
        context.Response.Headers[CoreLogging.CorrelationIdHeaderName] = correlationId;

        using (LogContext.PushProperty(CoreLogging.CorrelationIdPropertyName, correlationId))
        using (LogContext.PushProperty("TraceId", context.TraceIdentifier))
        {
            var stopwatch = Stopwatch.StartNew();
            await next(context);
            stopwatch.Stop();
            logger.LogInformation("HTTP {Method} {Path} => {StatusCode} in {DurationMs}ms", context.Request.Method, context.Request.Path, context.Response.StatusCode, stopwatch.ElapsedMilliseconds);
        }
    }

    private static string ResolveCorrelationId(HttpContext context)
    {
        var incomingCorrelationId = context.Request.Headers[CoreLogging.CorrelationIdHeaderName].ToString().Trim();
        if (!string.IsNullOrWhiteSpace(incomingCorrelationId)
            && incomingCorrelationId.Length <= CoreLogging.MaxCorrelationIdLength
            && incomingCorrelationId.All(character => !char.IsControl(character)))
        {
            return incomingCorrelationId;
        }

        return Guid.NewGuid().ToString("N");
    }
}

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(static state =>
        {
            var response = (HttpResponse)state;
            response.Headers[CoreSecurityHeaders.ContentSecurityPolicyName] = CoreSecurityHeaders.ContentSecurityPolicyValue;
            response.Headers[CoreSecurityHeaders.XssProtectionName] = CoreSecurityHeaders.XssProtectionValue;
            return Task.CompletedTask;
        }, context.Response);

        await next(context);
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
        context.Response.Headers["Retry-After"] = retryAfterSeconds.ToString();
        await ApiErrorResponseWriter.WriteAsync(context, StatusCodes.Status429TooManyRequests, "RATE_LIMITED", "Too many requests");
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
            await WriteAsync(context, exception.StatusCode, exception.Code, exception.Message, exception.Details.Select(x => new ErrorDetail(x.Field, x.Message)).ToArray(), exception);
        }
        catch (BadHttpRequestException exception)
        {
            logger.LogWarning(exception, "Handled malformed HTTP request");
            await WriteAsync(context, StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Invalid input data", [], exception);
        }
        catch (JsonException exception)
        {
            logger.LogWarning(exception, "Handled malformed JSON payload");
            await WriteAsync(context, StatusCodes.Status400BadRequest, "VALIDATION_ERROR", "Invalid input data", [], exception);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled exception");
            await WriteAsync(context, StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "Unexpected server error", [], exception);
        }
    }

    private async Task WriteAsync(HttpContext context, int statusCode, string code, string message, IReadOnlyList<ErrorDetail> details, Exception exception)
    {
        if (context.Response.HasStarted)
        {
            logger.LogWarning(exception, "Response has already started; cannot write standard error envelope");
            ExceptionDispatchInfo.Capture(exception).Throw();
        }

        await ApiErrorResponseWriter.WriteAsync(context, statusCode, code, message, details);
    }
}
