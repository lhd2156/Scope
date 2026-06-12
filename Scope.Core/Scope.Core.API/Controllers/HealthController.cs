using System.Reflection;
using Scope.Core.API.Middleware;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace Scope.Core.API.Controllers;

[ApiController]
[Route("api/core/health")]
public sealed class HealthController(
    CoreDbContext dbContext,
    IConfiguration configuration,
    IServiceProvider services) : ControllerBase
{
    private static readonly string ServiceVersion = ResolveAssemblyServiceVersion(typeof(HealthController).Assembly);

    private static string ResolveAssemblyServiceVersion(Assembly assembly)
        => ResolveServiceVersion(
            assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion,
            assembly.GetName().Version);

    private static string ResolveServiceVersion(string? informationalVersion, Version? assemblyVersion)
        => informationalVersion ?? assemblyVersion?.ToString() ?? "unknown";

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
        var bootstrap = configuration["KAFKA_BOOTSTRAP_SERVERS"];

        // Redis is optional at wire time (REDIS_URL empty → fall back to
        // single-replica behavior) but if we DID wire it, a silently dead
        // Redis is a scalability time bomb: SignalR fan-out breaks across
        // replicas, distributed rate limiting degrades to per-pod counters,
        // and nothing logs at ERROR. Surface it in /health so the LB / alert
        // pipeline can catch it.
        var redis = services.GetService<IConnectionMultiplexer>();
        bool? redisHealthy = null;
        if (redis is not null)
        {
            redisHealthy = false;
            try
            {
                var pong = await redis.GetDatabase().PingAsync();
                redisHealthy = pong.TotalMilliseconds < 500;
            }
            catch
            {
                redisHealthy = false;
            }
        }

        // Only the DB is a hard dependency — losing it means we can't serve.
        // Redis / Kafka are soft deps that degrade functionality (cross-replica
        // SignalR, distributed rate limits, event fan-out). Surface their
        // state in the response so dashboards catch the degradation, but keep
        // /health returning 200 so a Redis blip doesn't cascade into a fleet
        // of container restarts.
        var overallHealthy = canConnect;
        var degraded = overallHealthy && redisHealthy is false;
        ScopeObservability.SetServiceHealth("core", overallHealthy);

        var statusCode = overallHealthy ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable;
        return StatusCode(statusCode, new
        {
            status = !overallHealthy ? "unhealthy" : (degraded ? "degraded" : "healthy"),
            version = ServiceVersion,
            uptime = Environment.TickCount64,
            checks = new
            {
                database = canConnect,
                kafka = !string.IsNullOrWhiteSpace(bootstrap),
                redis = redisHealthy,
            }
        });
    }
}
