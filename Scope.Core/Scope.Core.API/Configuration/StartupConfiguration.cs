using System.Text;
using Scope.Core.API.Middleware;
using Scope.Core.Infrastructure.Configuration;
using Scope.Core.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace Scope.Core.API.Configuration;

public static class StartupConfiguration
{
    public const int MinJwtSecretBytes = 32;

    public sealed record KestrelLimitSettings(
        long MaxRequestBodySize,
        int MaxRequestHeadersTotalSize,
        int MaxRequestLineSize,
        int Http2MaxStreamsPerConnection,
        int Http2InitialConnectionWindowSize,
        int Http2InitialStreamWindowSize,
        long? MaxConcurrentConnections);

    public sealed record ContentHttpTimeoutSettings(
        int TotalTimeoutSeconds,
        int AttemptTimeoutSeconds,
        int RetryAttempts,
        int BreakDurationSeconds,
        int HandlerTotalTimeoutSeconds);

    public sealed record AuthRateLimitPartitionSettings(
        string PartitionKey,
        int PermitLimit,
        int QueueLimit);

    public static double ResolveSentryTracesSampleRate(IConfiguration configuration)
        => double.TryParse(configuration["SENTRY_TRACES_SAMPLE_RATE"], out var sampleRate)
            ? Math.Clamp(sampleRate, 0, 1)
            : 0.1;

    public static string ResolveSentryDsn(IConfiguration configuration)
        => configuration["SENTRY_DSN"] ?? string.Empty;

    public static string ResolveSentryEnvironment(IConfiguration configuration, IHostEnvironment environment)
    {
        var configured = configuration["SENTRY_ENVIRONMENT"];
        return string.IsNullOrWhiteSpace(configured) ? environment.EnvironmentName : configured;
    }

    public static string? NullIfWhiteSpace(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value;

    public static bool HasRedisUrl(string? redisUrl)
        => !string.IsNullOrWhiteSpace(redisUrl);

    public static bool UseHibpPasswordBreachChecker(IConfiguration configuration)
        => configuration.GetValue<bool>($"{HibpPasswordPolicyOptions.SectionName}:Enabled");

    public static bool ShouldUseSwagger(IConfiguration configuration, IHostEnvironment environment)
        => environment.IsDevelopment()
            || string.Equals(configuration["ENABLE_SWAGGER"], "true", StringComparison.OrdinalIgnoreCase);

    public static bool ShouldUseHstsAndHttpsRedirection(IHostEnvironment environment)
        => !environment.IsDevelopment();

    public static KestrelLimitSettings ResolveKestrelLimits(IConfiguration configuration)
    {
        var maxConnections = configuration["KESTREL_MAX_CONCURRENT_CONNECTIONS"];
        var connectionLimit = long.TryParse(maxConnections, out var parsedConnectionLimit) && parsedConnectionLimit > 0
            ? parsedConnectionLimit
            : (long?)null;

        return new KestrelLimitSettings(
            PositiveLong(configuration, "KESTREL_MAX_BODY_BYTES", 2097152),
            PositiveInt(configuration, "KESTREL_MAX_HEADERS_BYTES", 32768),
            PositiveInt(configuration, "KESTREL_MAX_REQUEST_LINE_BYTES", 8192),
            PositiveInt(configuration, "KESTREL_H2_MAX_STREAMS", 200),
            PositiveInt(configuration, "KESTREL_H2_CONN_WINDOW", 1048576),
            PositiveInt(configuration, "KESTREL_H2_STREAM_WINDOW", 524288),
            connectionLimit);
    }

    public static void ApplyKestrelLimits(KestrelServerOptions options, KestrelLimitSettings limits)
    {
        options.Limits.MaxRequestBodySize = limits.MaxRequestBodySize;
        options.Limits.MaxRequestHeadersTotalSize = limits.MaxRequestHeadersTotalSize;
        options.Limits.MaxRequestLineSize = limits.MaxRequestLineSize;
        options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(60);
        options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
        options.AddServerHeader = false;

        options.Limits.Http2.MaxStreamsPerConnection = limits.Http2MaxStreamsPerConnection;
        options.Limits.Http2.InitialConnectionWindowSize = limits.Http2InitialConnectionWindowSize;
        options.Limits.Http2.InitialStreamWindowSize = limits.Http2InitialStreamWindowSize;
        options.Limits.Http2.KeepAlivePingDelay = TimeSpan.FromSeconds(30);
        options.Limits.Http2.KeepAlivePingTimeout = TimeSpan.FromSeconds(20);

        if (limits.MaxConcurrentConnections is { } connLimit)
        {
            options.Limits.MaxConcurrentConnections = connLimit;
            options.Limits.MaxConcurrentUpgradedConnections = connLimit;
        }
    }

    public static void AddRedisConnectionMultiplexerIfConfigured(IServiceCollection services, string? redisUrl)
    {
        var normalizedRedisUrl = NullIfWhiteSpace(redisUrl);
        if (normalizedRedisUrl is null)
        {
            return;
        }

        services.AddSingleton<IConnectionMultiplexer>(_ =>
        {
            var redisConfig = ConfigurationOptions.Parse(normalizedRedisUrl);
            redisConfig.AbortOnConnectFail = false;
            redisConfig.ConnectRetry = 3;
            redisConfig.ConnectTimeout = 5000;
            return ConnectionMultiplexer.Connect(redisConfig);
        });
    }

    public static void AddSignalRRedisBackplaneIfConfigured(ISignalRServerBuilder signalR, string? redisUrl)
    {
        var normalizedRedisUrl = NullIfWhiteSpace(redisUrl);
        if (normalizedRedisUrl is null)
        {
            return;
        }

        signalR.AddStackExchangeRedis(normalizedRedisUrl, options =>
        {
            options.Configuration.ChannelPrefix = RedisChannel.Literal("scope-core");
            options.Configuration.AbortOnConnectFail = false;
        });
    }

    public static void AddDistributedCacheForRedis(IServiceCollection services, string? redisUrl)
    {
        var normalizedRedisUrl = NullIfWhiteSpace(redisUrl);
        if (normalizedRedisUrl is null)
        {
            services.AddDistributedMemoryCache();
            return;
        }

        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = normalizedRedisUrl;
            options.InstanceName = "scope-core:";
        });
    }

    public static string[] ResolveAllowedOrigins(IConfiguration configuration, IHostEnvironment environment)
    {
        var allowedOrigins = (configuration["CORE_ALLOWED_ORIGINS"] ?? configuration["CORE_FRONTEND_ORIGIN"] ?? string.Empty)
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .ToArray();

        if (allowedOrigins.Length == 0 && environment.IsDevelopment())
        {
            return ["http://localhost:5173", "http://localhost"];
        }

        if (allowedOrigins.Length == 0)
        {
            throw new InvalidOperationException(
                "CORE_ALLOWED_ORIGINS (or CORE_FRONTEND_ORIGIN) must be configured to an explicit allowlist outside Development.");
        }

        return allowedOrigins;
    }

    public static string ResolveCoreDbConnection(IConfiguration configuration, IHostEnvironment environment)
    {
        var configuredCoreDbConnection = configuration["CORE_DB_CONNECTION"];
        var namedCoreDbConnection = configuration.GetConnectionString("CoreDatabase");
        var coreDbConnection = !string.IsNullOrWhiteSpace(configuredCoreDbConnection)
            ? configuredCoreDbConnection
            : !string.IsNullOrWhiteSpace(namedCoreDbConnection)
                ? namedCoreDbConnection
                : environment.IsDevelopment()
                    ? "Server=(localdb)\\mssqllocaldb;Database=ScopeCore;Trusted_Connection=True;"
                    : throw new InvalidOperationException("CoreDatabase connection string must be configured outside Development.");

        if (!environment.IsDevelopment() && coreDbConnection.Contains("${", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("CoreDatabase connection string contains an unresolved placeholder.");
        }

        return coreDbConnection;
    }

    public static int ResolveCoreDbPoolSize(IConfiguration configuration)
        => PositiveInt(configuration, "CORE_DB_POOL_SIZE", 128);

    public static JwtOptions ResolveJwtOptions(IConfiguration configuration)
    {
        var jwtOptions = new JwtOptions
        {
            Secret = configuration["CORE_JWT_SECRET"] ?? string.Empty,
            Issuer = configuration["CORE_JWT_ISSUER"] ?? "scope-core",
            Audience = configuration["CORE_JWT_AUDIENCE"] ?? "scope-frontend",
            AccessTokenMinutes = int.TryParse(configuration["CORE_JWT_EXPIRATION_MINUTES"], out var accessMinutes) ? accessMinutes : 15,
            RefreshTokenDays = int.TryParse(configuration["CORE_JWT_REFRESH_DAYS"], out var refreshDays) ? refreshDays : 7,
        };

        if (string.IsNullOrWhiteSpace(jwtOptions.Secret))
        {
            throw new InvalidOperationException("CORE_JWT_SECRET must be configured. Generate a 256-bit secret and supply it via environment or secret manager.");
        }

        if (Encoding.UTF8.GetByteCount(jwtOptions.Secret) < MinJwtSecretBytes)
        {
            throw new InvalidOperationException($"CORE_JWT_SECRET must be at least {MinJwtSecretBytes} bytes (256 bits) of entropy.");
        }

        return jwtOptions;
    }

    public static string ResolveGlobalRateLimitPartitionKey(HttpContext httpContext)
        => httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public static AuthRateLimitPartitionSettings ResolveAuthRateLimitPartition(
        HttpContext httpContext,
        RateLimitOptions options)
    {
        var isRefresh = httpContext.Request.Path.Equals("/api/core/auth/refresh", StringComparison.OrdinalIgnoreCase);
        var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var partitionPrefix = isRefresh ? "auth-refresh" : "auth";

        return new AuthRateLimitPartitionSettings(
            $"{partitionPrefix}:{remoteIp}",
            isRefresh ? options.RefreshLimit : options.AuthLimit,
            isRefresh ? 20 : 2);
    }

    public static string? ResolveHubAccessToken(string? accessToken, PathString path)
        => !string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/api/core/hubs")
            ? accessToken
            : null;

    public static ContentHttpTimeoutSettings ResolveContentHttpTimeouts(IConfiguration configuration)
    {
        var totalTimeout = PositiveInt(configuration, "HTTP_CONTENT_TOTAL_TIMEOUT_SECONDS", 5);
        return new ContentHttpTimeoutSettings(
            totalTimeout,
            PositiveInt(configuration, "HTTP_CONTENT_ATTEMPT_TIMEOUT_SECONDS", 2),
            int.TryParse(configuration["HTTP_CONTENT_RETRY_ATTEMPTS"], out var retryAttempts) ? retryAttempts : 3,
            PositiveInt(configuration, "HTTP_CONTENT_BREAK_DURATION_SECONDS", 30),
            Math.Max(1, totalTimeout - 1));
    }

    public static string? ResolveGrpcInternalToken(IConfiguration configuration, IHostEnvironment environment, string jwtSecret)
    {
        var grpcInternalToken = configuration["GRPC_INTERNAL_TOKEN"]?.Trim();
        if (string.IsNullOrWhiteSpace(grpcInternalToken))
        {
            if (!environment.IsDevelopment())
            {
                throw new InvalidOperationException("GRPC_INTERNAL_TOKEN must be configured outside Development.");
            }

            return null;
        }

        if (Encoding.UTF8.GetByteCount(grpcInternalToken) < MinJwtSecretBytes)
        {
            throw new InvalidOperationException($"GRPC_INTERNAL_TOKEN must be at least {MinJwtSecretBytes} bytes (256 bits) of entropy.");
        }

        if (string.Equals(grpcInternalToken, jwtSecret, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("GRPC_INTERNAL_TOKEN must be distinct from CORE_JWT_SECRET.");
        }

        return grpcInternalToken;
    }

    public static Uri BuildOtlpTracesEndpoint(string endpoint)
    {
        var normalized = endpoint.Trim().TrimEnd('/');
        if (!normalized.EndsWith("/v1/traces", StringComparison.OrdinalIgnoreCase))
        {
            normalized = $"{normalized}/v1/traces";
        }

        return new Uri(normalized, UriKind.Absolute);
    }

    private static int PositiveInt(IConfiguration configuration, string key, int defaultValue)
        => int.TryParse(configuration[key], out var value) && value > 0 ? value : defaultValue;

    private static long PositiveLong(IConfiguration configuration, string key, long defaultValue)
        => long.TryParse(configuration[key], out var value) && value > 0 ? value : defaultValue;
}
