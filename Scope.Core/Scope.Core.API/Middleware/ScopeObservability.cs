using System.Diagnostics;
using Microsoft.AspNetCore.Routing;
using Prometheus;

namespace Scope.Core.API.Middleware;

public static class ScopeObservability
{
    public const string ActivitySourceName = "Scope.Core.API";

    public static readonly ActivitySource ActivitySource = new(ActivitySourceName);

    private static readonly Counter HttpRequests = Metrics.CreateCounter(
        "scope_core_http_requests_total",
        "Total Core API HTTP requests.",
        new CounterConfiguration
        {
            LabelNames = ["method", "route", "status_code"],
        });

    private static readonly Histogram HttpRequestDuration = Metrics.CreateHistogram(
        "scope_core_http_request_duration_seconds",
        "Core API HTTP request latency.",
        new HistogramConfiguration
        {
            LabelNames = ["method", "route"],
            Buckets = Histogram.ExponentialBuckets(0.005, 2, 12),
        });

    private static readonly Gauge ServiceHealth = Metrics.CreateGauge(
        "scope_core_service_health",
        "Core service health state reported by the health endpoint.",
        new GaugeConfiguration
        {
            LabelNames = ["service"],
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
