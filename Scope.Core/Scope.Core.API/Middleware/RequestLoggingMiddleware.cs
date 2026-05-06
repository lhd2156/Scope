using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Scope.Core.API.Middleware;

public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        using var activity = ScopeObservability.ActivitySource.StartActivity(
            $"{context.Request.Method} {context.Request.Path}",
            ActivityKind.Server);
        activity?.SetTag("http.request.method", context.Request.Method);
        activity?.SetTag("url.path", context.Request.Path.Value);
        activity?.SetTag("scope.correlation_id", context.Request.Headers["X-Correlation-Id"].ToString());

        var stopwatch = Stopwatch.StartNew();

        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            stopwatch.Stop();
            var errorRoute = ScopeObservability.ResolveRoute(context);
            ScopeObservability.ObserveHttpRequest(context.Request.Method, errorRoute, 500, stopwatch.Elapsed);
            activity?.SetTag("http.route", errorRoute);
            activity?.SetTag("http.response.status_code", 500);
            activity?.SetStatus(ActivityStatusCode.Error, exception.Message);
            logger.LogDebug(
                "HTTP {Method} {Path} => {StatusCode} in {DurationMs}ms",
                context.Request.Method,
                context.Request.Path,
                500,
                stopwatch.ElapsedMilliseconds);
            throw;
        }

        stopwatch.Stop();
        var route = ScopeObservability.ResolveRoute(context);
        ScopeObservability.ObserveHttpRequest(context.Request.Method, route, context.Response.StatusCode, stopwatch.Elapsed);
        activity?.SetTag("http.route", route);
        activity?.SetTag("http.response.status_code", context.Response.StatusCode);
        if (context.Response.StatusCode >= 500)
        {
            activity?.SetStatus(ActivityStatusCode.Error);
        }

        logger.LogDebug(
            "HTTP {Method} {Path} => {StatusCode} in {DurationMs}ms",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            stopwatch.ElapsedMilliseconds);
    }
}
