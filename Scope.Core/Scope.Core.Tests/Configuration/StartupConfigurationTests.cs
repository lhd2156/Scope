using Scope.Core.API.Configuration;
using Scope.Core.API.Middleware;
using Scope.Core.Infrastructure.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using StackExchange.Redis;
using System.Net;
using Xunit;

namespace Scope.Core.Tests.Configuration;

public sealed class StartupConfigurationTests
{
    private const string LongSecret = "test-secret-test-secret-test-secret-test";
    private const string OtherLongSecret = "other-secret-other-secret-other-secret";

    [Fact]
    public void ResolveSentryTracesSampleRate_UsesDefaultParsesAndClamps()
    {
        Assert.Equal(0.1, StartupConfiguration.ResolveSentryTracesSampleRate(Config()));
        Assert.Equal(0.25, StartupConfiguration.ResolveSentryTracesSampleRate(Config(("SENTRY_TRACES_SAMPLE_RATE", "0.25"))));
        Assert.Equal(0, StartupConfiguration.ResolveSentryTracesSampleRate(Config(("SENTRY_TRACES_SAMPLE_RATE", "-1"))));
        Assert.Equal(1, StartupConfiguration.ResolveSentryTracesSampleRate(Config(("SENTRY_TRACES_SAMPLE_RATE", "2"))));
        Assert.Equal(0.1, StartupConfiguration.ResolveSentryTracesSampleRate(Config(("SENTRY_TRACES_SAMPLE_RATE", "not-a-number"))));
        Assert.Equal(string.Empty, StartupConfiguration.ResolveSentryDsn(Config()));
        Assert.Equal("dsn", StartupConfiguration.ResolveSentryDsn(Config(("SENTRY_DSN", "dsn"))));
        Assert.Equal("Production", StartupConfiguration.ResolveSentryEnvironment(Config(("SENTRY_ENVIRONMENT", " ")), Env("Production")));
        Assert.Equal("staging", StartupConfiguration.ResolveSentryEnvironment(Config(("SENTRY_ENVIRONMENT", "staging")), Env("Production")));
        Assert.Null(StartupConfiguration.NullIfWhiteSpace("  "));
        Assert.Equal("release-1", StartupConfiguration.NullIfWhiteSpace("release-1"));
    }

    [Fact]
    public void StartupFeaturePredicates_CoverRedisHibpSwaggerAndStrictTransportToggles()
    {
        Assert.False(StartupConfiguration.HasRedisUrl(null));
        Assert.False(StartupConfiguration.HasRedisUrl(" "));
        Assert.True(StartupConfiguration.HasRedisUrl("localhost:6379"));

        Assert.False(StartupConfiguration.UseHibpPasswordBreachChecker(Config()));
        Assert.True(StartupConfiguration.UseHibpPasswordBreachChecker(Config(("Hibp:Enabled", "true"))));

        Assert.True(StartupConfiguration.ShouldUseSwagger(Config(), Env(Environments.Development)));
        Assert.True(StartupConfiguration.ShouldUseSwagger(Config(("ENABLE_SWAGGER", "TRUE")), Env("Production")));
        Assert.False(StartupConfiguration.ShouldUseSwagger(Config(("ENABLE_SWAGGER", "false")), Env("Production")));

        Assert.False(StartupConfiguration.ShouldUseHstsAndHttpsRedirection(Env(Environments.Development)));
        Assert.True(StartupConfiguration.ShouldUseHstsAndHttpsRedirection(Env("Production")));
    }

    [Fact]
    public void ResolveKestrelLimits_UsesDefaultsAndPositiveOverrides()
    {
        var defaults = StartupConfiguration.ResolveKestrelLimits(Config(
            ("KESTREL_MAX_BODY_BYTES", "0"),
            ("KESTREL_MAX_HEADERS_BYTES", "bad"),
            ("KESTREL_MAX_REQUEST_LINE_BYTES", "-10"),
            ("KESTREL_H2_MAX_STREAMS", "0"),
            ("KESTREL_H2_CONN_WINDOW", "bad"),
            ("KESTREL_H2_STREAM_WINDOW", "-1"),
            ("KESTREL_MAX_CONCURRENT_CONNECTIONS", "0")));

        Assert.Equal(2097152, defaults.MaxRequestBodySize);
        Assert.Equal(32768, defaults.MaxRequestHeadersTotalSize);
        Assert.Equal(8192, defaults.MaxRequestLineSize);
        Assert.Equal(200, defaults.Http2MaxStreamsPerConnection);
        Assert.Equal(1048576, defaults.Http2InitialConnectionWindowSize);
        Assert.Equal(524288, defaults.Http2InitialStreamWindowSize);
        Assert.Null(defaults.MaxConcurrentConnections);

        var configured = StartupConfiguration.ResolveKestrelLimits(Config(
            ("KESTREL_MAX_BODY_BYTES", "1024"),
            ("KESTREL_MAX_HEADERS_BYTES", "2048"),
            ("KESTREL_MAX_REQUEST_LINE_BYTES", "4096"),
            ("KESTREL_H2_MAX_STREAMS", "40"),
            ("KESTREL_H2_CONN_WINDOW", "65536"),
            ("KESTREL_H2_STREAM_WINDOW", "32768"),
            ("KESTREL_MAX_CONCURRENT_CONNECTIONS", "12")));

        Assert.Equal(1024, configured.MaxRequestBodySize);
        Assert.Equal(2048, configured.MaxRequestHeadersTotalSize);
        Assert.Equal(4096, configured.MaxRequestLineSize);
        Assert.Equal(40, configured.Http2MaxStreamsPerConnection);
        Assert.Equal(65536, configured.Http2InitialConnectionWindowSize);
        Assert.Equal(32768, configured.Http2InitialStreamWindowSize);
        Assert.Equal(12, configured.MaxConcurrentConnections);
    }

    [Fact]
    public void StartupRuntimeHelpers_ApplyKestrelRedisCacheRateLimitAndHubTokenDecisions()
    {
        var kestrel = new KestrelServerOptions();
        StartupConfiguration.ApplyKestrelLimits(kestrel, new StartupConfiguration.KestrelLimitSettings(
            MaxRequestBodySize: 1024,
            MaxRequestHeadersTotalSize: 2048,
            MaxRequestLineSize: 4096,
            Http2MaxStreamsPerConnection: 32,
            Http2InitialConnectionWindowSize: 65536,
            Http2InitialStreamWindowSize: 65536,
            MaxConcurrentConnections: 12));
        Assert.Equal(1024, kestrel.Limits.MaxRequestBodySize);
        Assert.Equal(2048, kestrel.Limits.MaxRequestHeadersTotalSize);
        Assert.Equal(4096, kestrel.Limits.MaxRequestLineSize);
        Assert.Equal(32, kestrel.Limits.Http2.MaxStreamsPerConnection);
        Assert.Equal(12, kestrel.Limits.MaxConcurrentConnections);
        Assert.Equal(12, kestrel.Limits.MaxConcurrentUpgradedConnections);
        Assert.False(kestrel.AddServerHeader);

        var uncappedKestrel = new KestrelServerOptions();
        StartupConfiguration.ApplyKestrelLimits(uncappedKestrel, new StartupConfiguration.KestrelLimitSettings(
            1024,
            2048,
            4096,
            32,
            65536,
            65536,
            null));
        Assert.Null(uncappedKestrel.Limits.MaxConcurrentConnections);
        Assert.Null(uncappedKestrel.Limits.MaxConcurrentUpgradedConnections);

        var services = new ServiceCollection();
        StartupConfiguration.AddRedisConnectionMultiplexerIfConfigured(services, " ");
        Assert.DoesNotContain(services, descriptor => descriptor.ServiceType == typeof(IConnectionMultiplexer));
        StartupConfiguration.AddRedisConnectionMultiplexerIfConfigured(services, "localhost:6379");
        Assert.Contains(services, descriptor => descriptor.ServiceType == typeof(IConnectionMultiplexer));

        var memoryCacheServices = new ServiceCollection();
        StartupConfiguration.AddDistributedCacheForRedis(memoryCacheServices, null);
        Assert.Contains(memoryCacheServices, descriptor => descriptor.ServiceType == typeof(IDistributedCache));

        var redisCacheServices = new ServiceCollection();
        StartupConfiguration.AddDistributedCacheForRedis(redisCacheServices, "localhost:6379");
        Assert.Contains(redisCacheServices, descriptor => descriptor.ServiceType == typeof(IDistributedCache));

        var signalRServices = new ServiceCollection();
        var signalR = signalRServices.AddSignalR();
        var beforeRedisBackplaneCount = signalRServices.Count;
        StartupConfiguration.AddSignalRRedisBackplaneIfConfigured(signalR, " ");
        Assert.Equal(beforeRedisBackplaneCount, signalRServices.Count);
        StartupConfiguration.AddSignalRRedisBackplaneIfConfigured(signalR, "localhost:6379");
        Assert.True(signalRServices.Count > beforeRedisBackplaneCount);

        var context = new DefaultHttpContext();
        Assert.Equal("unknown", StartupConfiguration.ResolveGlobalRateLimitPartitionKey(context));
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");
        Assert.Equal("203.0.113.10", StartupConfiguration.ResolveGlobalRateLimitPartitionKey(context));

        var rateLimitOptions = new RateLimitOptions
        {
            AuthLimit = 7,
            RefreshLimit = 3,
        };
        var unknownRemoteContext = new DefaultHttpContext();
        unknownRemoteContext.Request.Path = "/api/core/auth/login";
        Assert.Equal(
            new StartupConfiguration.AuthRateLimitPartitionSettings("auth:unknown", 7, 2),
            StartupConfiguration.ResolveAuthRateLimitPartition(unknownRemoteContext, rateLimitOptions));
        unknownRemoteContext.Request.Path = "/api/core/auth/refresh";
        Assert.Equal(
            new StartupConfiguration.AuthRateLimitPartitionSettings("auth-refresh:unknown", 3, 20),
            StartupConfiguration.ResolveAuthRateLimitPartition(unknownRemoteContext, rateLimitOptions));

        context.Request.Path = "/api/core/auth/login";
        Assert.Equal(
            new StartupConfiguration.AuthRateLimitPartitionSettings("auth:203.0.113.10", 7, 2),
            StartupConfiguration.ResolveAuthRateLimitPartition(context, rateLimitOptions));
        context.Request.Path = "/api/core/auth/refresh";
        Assert.Equal(
            new StartupConfiguration.AuthRateLimitPartitionSettings("auth-refresh:203.0.113.10", 3, 20),
            StartupConfiguration.ResolveAuthRateLimitPartition(context, rateLimitOptions));

        Assert.Equal("hub-token", StartupConfiguration.ResolveHubAccessToken("hub-token", "/api/core/hubs/trips"));
        Assert.Null(StartupConfiguration.ResolveHubAccessToken("hub-token", "/api/core/auth/login"));
        Assert.Null(StartupConfiguration.ResolveHubAccessToken("   ", "/api/core/hubs/trips"));
    }

    [Fact]
    public void ResolveAllowedOrigins_UsesExplicitFrontendFallbackDevelopmentDefaultAndProductionGuard()
    {
        Assert.Equal(
            new[] { "https://app.scopetrips.com", "https://scopetrips.com" },
            StartupConfiguration.ResolveAllowedOrigins(
                Config(("CORE_ALLOWED_ORIGINS", " https://app.scopetrips.com ; https://scopetrips.com ")),
                Env("Production")));
        Assert.Equal(
            new[] { "https://legacy.scopetrips.com" },
            StartupConfiguration.ResolveAllowedOrigins(
                Config(("CORE_FRONTEND_ORIGIN", "https://legacy.scopetrips.com")),
                Env("Production")));
        Assert.Equal(
            new[] { "http://localhost:5173", "http://localhost" },
            StartupConfiguration.ResolveAllowedOrigins(Config(), Env(Environments.Development)));

        Assert.Throws<InvalidOperationException>(() =>
            StartupConfiguration.ResolveAllowedOrigins(Config(), Env("Production")));
    }

    [Fact]
    public void ResolveCoreDbConnection_UsesConfiguredNamedDevelopmentFallbackAndProductionGuards()
    {
        Assert.Equal(
            "Server=explicit;",
            StartupConfiguration.ResolveCoreDbConnection(Config(("CORE_DB_CONNECTION", "Server=explicit;")), Env("Production")));
        Assert.Equal(
            "Server=named;",
            StartupConfiguration.ResolveCoreDbConnection(Config(("ConnectionStrings:CoreDatabase", "Server=named;")), Env("Production")));
        Assert.Contains(
            "ScopeCore",
            StartupConfiguration.ResolveCoreDbConnection(Config(), Env(Environments.Development)));

        Assert.Throws<InvalidOperationException>(() =>
            StartupConfiguration.ResolveCoreDbConnection(Config(), Env("Production")));
        Assert.Throws<InvalidOperationException>(() =>
            StartupConfiguration.ResolveCoreDbConnection(Config(("CORE_DB_CONNECTION", "Server=${DB_HOST};")), Env("Production")));
        Assert.Equal(128, StartupConfiguration.ResolveCoreDbPoolSize(Config(("CORE_DB_POOL_SIZE", "0"))));
        Assert.Equal(64, StartupConfiguration.ResolveCoreDbPoolSize(Config(("CORE_DB_POOL_SIZE", "64"))));
    }

    [Fact]
    public void ResolveJwtOptions_ParsesDefaultsOverridesAndRejectsMissingOrWeakSecrets()
    {
        var defaults = StartupConfiguration.ResolveJwtOptions(Config(("CORE_JWT_SECRET", LongSecret)));
        Assert.Equal("scope-core", defaults.Issuer);
        Assert.Equal("scope-frontend", defaults.Audience);
        Assert.Equal(15, defaults.AccessTokenMinutes);
        Assert.Equal(7, defaults.RefreshTokenDays);

        var configured = StartupConfiguration.ResolveJwtOptions(Config(
            ("CORE_JWT_SECRET", LongSecret),
            ("CORE_JWT_ISSUER", "issuer"),
            ("CORE_JWT_AUDIENCE", "audience"),
            ("CORE_JWT_EXPIRATION_MINUTES", "20"),
            ("CORE_JWT_REFRESH_DAYS", "30")));
        Assert.Equal("issuer", configured.Issuer);
        Assert.Equal("audience", configured.Audience);
        Assert.Equal(20, configured.AccessTokenMinutes);
        Assert.Equal(30, configured.RefreshTokenDays);

        var invalidDurations = StartupConfiguration.ResolveJwtOptions(Config(
            ("CORE_JWT_SECRET", LongSecret),
            ("CORE_JWT_EXPIRATION_MINUTES", "bad"),
            ("CORE_JWT_REFRESH_DAYS", "bad")));
        Assert.Equal(15, invalidDurations.AccessTokenMinutes);
        Assert.Equal(7, invalidDurations.RefreshTokenDays);

        Assert.Throws<InvalidOperationException>(() => StartupConfiguration.ResolveJwtOptions(Config()));
        Assert.Throws<InvalidOperationException>(() => StartupConfiguration.ResolveJwtOptions(Config(("CORE_JWT_SECRET", "short"))));
    }

    [Fact]
    public void ResolveContentHttpTimeouts_UsesPositiveOverridesAndFallbacks()
    {
        var defaults = StartupConfiguration.ResolveContentHttpTimeouts(Config(
            ("HTTP_CONTENT_TOTAL_TIMEOUT_SECONDS", "0"),
            ("HTTP_CONTENT_ATTEMPT_TIMEOUT_SECONDS", "bad"),
            ("HTTP_CONTENT_RETRY_ATTEMPTS", "bad"),
            ("HTTP_CONTENT_BREAK_DURATION_SECONDS", "-1")));

        Assert.Equal(5, defaults.TotalTimeoutSeconds);
        Assert.Equal(2, defaults.AttemptTimeoutSeconds);
        Assert.Equal(3, defaults.RetryAttempts);
        Assert.Equal(30, defaults.BreakDurationSeconds);
        Assert.Equal(4, defaults.HandlerTotalTimeoutSeconds);

        var configured = StartupConfiguration.ResolveContentHttpTimeouts(Config(
            ("HTTP_CONTENT_TOTAL_TIMEOUT_SECONDS", "1"),
            ("HTTP_CONTENT_ATTEMPT_TIMEOUT_SECONDS", "3"),
            ("HTTP_CONTENT_RETRY_ATTEMPTS", "5"),
            ("HTTP_CONTENT_BREAK_DURATION_SECONDS", "9")));

        Assert.Equal(1, configured.TotalTimeoutSeconds);
        Assert.Equal(3, configured.AttemptTimeoutSeconds);
        Assert.Equal(5, configured.RetryAttempts);
        Assert.Equal(9, configured.BreakDurationSeconds);
        Assert.Equal(1, configured.HandlerTotalTimeoutSeconds);
    }

    [Fact]
    public void ResolveGrpcInternalToken_AllowsDevelopmentMissingAndRejectsProductionMissingWeakOrMatchingToken()
    {
        Assert.Null(StartupConfiguration.ResolveGrpcInternalToken(Config(), Env(Environments.Development), LongSecret));
        Assert.Equal(
            OtherLongSecret,
            StartupConfiguration.ResolveGrpcInternalToken(Config(("GRPC_INTERNAL_TOKEN", $" {OtherLongSecret} ")), Env("Production"), LongSecret));

        Assert.Throws<InvalidOperationException>(() =>
            StartupConfiguration.ResolveGrpcInternalToken(Config(), Env("Production"), LongSecret));
        Assert.Throws<InvalidOperationException>(() =>
            StartupConfiguration.ResolveGrpcInternalToken(Config(("GRPC_INTERNAL_TOKEN", "short")), Env("Production"), LongSecret));
        Assert.Throws<InvalidOperationException>(() =>
            StartupConfiguration.ResolveGrpcInternalToken(Config(("GRPC_INTERNAL_TOKEN", LongSecret)), Env("Production"), LongSecret));
    }

    [Fact]
    public void BuildOtlpTracesEndpoint_AppendsTracesPathOnlyWhenNeeded()
    {
        Assert.Equal(
            "http://collector:4317/v1/traces",
            StartupConfiguration.BuildOtlpTracesEndpoint(" http://collector:4317/ ").ToString());
        Assert.Equal(
            "http://collector:4317/v1/traces",
            StartupConfiguration.BuildOtlpTracesEndpoint("http://collector:4317/v1/traces").ToString());
        Assert.Equal(
            "http://collector:4317/V1/TRACES",
            StartupConfiguration.BuildOtlpTracesEndpoint("http://collector:4317/V1/TRACES").ToString());
    }

    private static IConfiguration Config(params (string Key, string? Value)[] values)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(values.ToDictionary(x => x.Key, x => x.Value))
            .Build();

    private static IHostEnvironment Env(string name) => new TestHostEnvironment(name);

    private sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = "Scope.Core.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
