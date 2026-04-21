using System.Collections.Concurrent;
using System.Diagnostics;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Models;
using Microsoft.AspNetCore.Routing;
using Prometheus;

namespace Atlas.Core.API.Middleware;

public static class AtlasObservability
{
    public const string ActivitySourceName = "Atlas.Core.API";

    public static readonly ActivitySource ActivitySource = new(ActivitySourceName);

    private static readonly Counter HttpRequests = Metrics.CreateCounter(
        "atlas_core_http_requests_total",
        "Total Core API HTTP requests.",
        new CounterConfiguration
        {
            LabelNames = ["method", "route", "status_code"]
        });

    private static readonly Histogram HttpRequestDuration = Metrics.CreateHistogram(
        "atlas_core_http_request_duration_seconds",
        "Core API HTTP request latency.",
        new HistogramConfiguration
        {
            LabelNames = ["method", "route"],
            Buckets = Histogram.ExponentialBuckets(0.005, 2, 12)
        });

    private static readonly Gauge ServiceHealth = Metrics.CreateGauge(
        "atlas_core_service_health",
        "Core service health state reported by the health endpoint.",
        new GaugeConfiguration
        {
            LabelNames = ["service"]
        });

    public static void ObserveHttpRequest(string method, string route, int statusCode, TimeSpan duration)
    {
        var normalizedRoute = NormalizeRoute(route);
        HttpRequests.Labels(method, normalizedRoute, statusCode.ToString()).Inc();
        HttpRequestDuration.Labels(method, normalizedRoute).Observe(duration.TotalSeconds);
    }

    public static void SetServiceHealth(string service, bool healthy)
        => ServiceHealth.Labels(service).Set(healthy ? 1 : 0);

    public static string ResolveRoute(HttpContext context)
    {
        if (context.GetEndpoint() is RouteEndpoint routeEndpoint && !string.IsNullOrWhiteSpace(routeEndpoint.RoutePattern.RawText))
        {
            return NormalizeRoute(routeEndpoint.RoutePattern.RawText);
        }

        return NormalizeRoute(context.Request.Path.Value);
    }

    private static string NormalizeRoute(string? route)
    {
        if (string.IsNullOrWhiteSpace(route))
        {
            return "/";
        }

        return route.StartsWith('/') ? route : $"/{route}";
    }
}

public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        using var activity = AtlasObservability.ActivitySource.StartActivity(
            $"{context.Request.Method} {context.Request.Path}",
            ActivityKind.Server);
        activity?.SetTag("http.request.method", context.Request.Method);
        activity?.SetTag("url.path", context.Request.Path.Value);
        activity?.SetTag("atlas.correlation_id", context.Request.Headers["X-Correlation-Id"].ToString());

        var stopwatch = Stopwatch.StartNew();

        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            stopwatch.Stop();
            var errorRoute = AtlasObservability.ResolveRoute(context);
            AtlasObservability.ObserveHttpRequest(context.Request.Method, errorRoute, 500, stopwatch.Elapsed);
            activity?.SetTag("http.route", errorRoute);
            activity?.SetTag("http.response.status_code", 500);
            activity?.SetStatus(ActivityStatusCode.Error, exception.Message);
            logger.LogInformation(
                "HTTP {Method} {Path} => {StatusCode} in {DurationMs}ms",
                context.Request.Method,
                context.Request.Path,
                500,
                stopwatch.ElapsedMilliseconds);
            throw;
        }

        stopwatch.Stop();
        var route = AtlasObservability.ResolveRoute(context);
        AtlasObservability.ObserveHttpRequest(context.Request.Method, route, context.Response.StatusCode, stopwatch.Elapsed);
        activity?.SetTag("http.route", route);
        activity?.SetTag("http.response.status_code", context.Response.StatusCode);
        if (context.Response.StatusCode >= 500)
        {
            activity?.SetStatus(ActivityStatusCode.Error);
        }

        logger.LogInformation(
            "HTTP {Method} {Path} => {StatusCode} in {DurationMs}ms",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            stopwatch.ElapsedMilliseconds);
    }
}

public sealed class RateLimitMiddleware(RequestDelegate next)
{
    private static readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> Requests = new();
    private const int Limit = 100;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/metrics"))
        {
            await next(context);
            return;
        }

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
