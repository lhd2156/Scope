using System.Collections.Concurrent;
using System.Text.Json;
using Scope.Core.Domain.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Scope.Core.API.Middleware;

// Rate limiter with optional Redis-backed distributed counters.
//
// When an IConnectionMultiplexer is registered (i.e. REDIS_URL is configured at
// startup), the middleware enforces a fixed-window counter against Redis via an
// atomic INCR+EXPIRE. With N replicas this keeps the effective limit equal to
// the configured value rather than N * value (the bug of the previous in-memory
// implementation). If Redis is unreachable we fail soft to the per-instance
// in-memory queue so that enforcement continues rather than fail-open.
public sealed class RateLimitMiddleware(
    RequestDelegate next,
    ILogger<RateLimitMiddleware> logger,
    IOptions<RateLimitOptions> options,
    IServiceProvider services)
{
    private const string RedisFixedWindowScript = """
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return current
        """;

    private static readonly HashSet<string> StrictAuthPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/core/auth/register",
        "/api/core/auth/login",
        "/api/core/auth/password-reset/request",
        "/api/core/auth/password-reset/complete",
        "/api/core/auth/email/verify",
        "/api/core/auth/email/verify/send",
        "/api/core/auth/mfa/enroll",
        "/api/core/auth/mfa/enroll/confirm",
        "/api/core/auth/mfa/disable",
    };

    private static readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> GlobalRequests = new();
    private static readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> AuthRequests = new();
    private static readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> RefreshRequests = new();

    private readonly RateLimitOptions limits = options.Value;
    private readonly TimeSpan window = TimeSpan.FromSeconds(options.Value.WindowSeconds);

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/metrics"))
        {
            await next(context);
            return;
        }

        var key = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var isRefresh = context.Request.Path.Equals("/api/core/auth/refresh", StringComparison.OrdinalIgnoreCase);
        var isStrictAuth = IsStrictAuthPath(context.Request.Path);
        var redis = services.GetService<IConnectionMultiplexer>();

        if (isRefresh && !await PermitAsync(redis, RefreshRequests, $"auth-refresh:{key}", limits.RefreshLimit))
        {
            await WriteLimited(context);
            return;
        }

        if (isStrictAuth && !await PermitAsync(redis, AuthRequests, $"auth:{key}", limits.AuthLimit))
        {
            await WriteLimited(context);
            return;
        }
        if (!await PermitAsync(redis, GlobalRequests, $"global:{key}", limits.GlobalLimit))
        {
            await WriteLimited(context);
            return;
        }

        await next(context);
    }

    private static bool IsStrictAuthPath(PathString path)
        => StrictAuthPaths.Contains(path.Value ?? string.Empty);

    private async Task<bool> PermitAsync(
        IConnectionMultiplexer? redis,
        ConcurrentDictionary<string, Queue<DateTimeOffset>> localStore,
        string key,
        int limit)
    {
        if (redis is { IsConnected: true })
        {
            try
            {
                var db = redis.GetDatabase();
                var cacheKey = $"scope:core:rl:{key}";
                var result = await db.ScriptEvaluateAsync(
                    RedisFixedWindowScript,
                    [cacheKey],
                    [(long)Math.Ceiling(window.TotalMilliseconds)]);
                var count = (long)result;
                return count <= limit;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Redis rate-limit lookup failed; falling back to in-memory for key {Key}", key);
            }
        }
        return PermitLocal(localStore, key, DateTimeOffset.UtcNow, limit, window);
    }

    private static bool PermitLocal(
        ConcurrentDictionary<string, Queue<DateTimeOffset>> store,
        string key,
        DateTimeOffset now,
        int limit,
        TimeSpan window)
    {
        var queue = store.GetOrAdd(key, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            while (queue.Count > 0 && now - queue.Peek() > window) queue.Dequeue();
            if (queue.Count >= limit) return false;
            queue.Enqueue(now);
            return true;
        }
    }

    private async Task WriteLimited(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.ContentType = "application/json";
        context.Response.Headers["Retry-After"] = limits.RetryAfterSeconds;
        var body = JsonSerializer.Serialize(
            new ErrorEnvelope(new ErrorBody("RATE_LIMITED", "Too many requests", [], context.TraceIdentifier)),
            JsonSerializerOptions.Web);
        await context.Response.WriteAsync(body);
    }
}
