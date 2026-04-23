using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using Atlas.Core.API.Middleware;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Infrastructure.Configuration;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Prometheus;
using Serilog;
using Serilog.Formatting.Compact;
using StackExchange.Redis;

const int MinJwtSecretBytes = 32;

var builder = WebApplication.CreateBuilder(args);
Log.Logger = new LoggerConfiguration().WriteTo.Console(new RenderedCompactJsonFormatter()).CreateLogger();
builder.Host.UseSerilog();

// Kestrel limits — defense in depth alongside the nginx edge.
// - MaxRequestBodySize caps the worst-case ingest per request (2 MiB). Photo
//   uploads go to Content via nginx so core never handles large bodies.
// - Concurrent/queue limits protect against request floods before we reach
//   the rate limiter middleware; tune via KESTREL_* env vars.
builder.WebHost.ConfigureKestrel((context, options) =>
{
    var cfg = context.Configuration;
    options.Limits.MaxRequestBodySize = long.Parse(cfg["KESTREL_MAX_BODY_BYTES"] ?? "2097152");
    options.Limits.MaxRequestHeadersTotalSize = int.Parse(cfg["KESTREL_MAX_HEADERS_BYTES"] ?? "32768");
    options.Limits.MaxRequestLineSize = int.Parse(cfg["KESTREL_MAX_REQUEST_LINE_BYTES"] ?? "8192");
    options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(60);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
    options.AddServerHeader = false;

    // HTTP/2 tuning for high-concurrency SignalR + REST workloads. Behind
    // nginx we still speak HTTP/1.1 on the edge today, but Kestrel negotiates
    // H2 directly for any in-cluster calls (intel ↔ core, future gRPC) and
    // tests that connect straight to Kestrel. Raising the per-connection
    // stream cap + window sizes avoids head-of-line blocking when a single
    // client fires many parallel requests (common for the SPA fan-out on
    // load). Values mirror sane ASP.NET 8 defaults, tunable via env.
    options.Limits.Http2.MaxStreamsPerConnection = int.Parse(cfg["KESTREL_H2_MAX_STREAMS"] ?? "200");
    options.Limits.Http2.InitialConnectionWindowSize = int.Parse(cfg["KESTREL_H2_CONN_WINDOW"] ?? "1048576");
    options.Limits.Http2.InitialStreamWindowSize = int.Parse(cfg["KESTREL_H2_STREAM_WINDOW"] ?? "524288");
    options.Limits.Http2.KeepAlivePingDelay = TimeSpan.FromSeconds(30);
    options.Limits.Http2.KeepAlivePingTimeout = TimeSpan.FromSeconds(20);

    // Concurrent connection caps: when set, connections above the limit are
    // queued rather than rejected, smoothing traffic spikes. Null (default)
    // means unlimited, which is fine behind nginx with its own limit_conn.
    var maxConnections = cfg["KESTREL_MAX_CONCURRENT_CONNECTIONS"];
    if (long.TryParse(maxConnections, out var connLimit) && connLimit > 0)
    {
        options.Limits.MaxConcurrentConnections = connLimit;
        options.Limits.MaxConcurrentUpgradedConnections = connLimit;
    }
});

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("atlas-core"))
    .WithTracing(tracing =>
    {
        tracing.AddSource(AtlasObservability.ActivitySourceName);

        var otlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
        {
            tracing.AddOtlpExporter(options => options.Endpoint = BuildOtlpTracesEndpoint(otlpEndpoint));
        }
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Shared Redis connection. A single IConnectionMultiplexer is registered when
// REDIS_URL is provided so that SignalR, the distributed rate limiter, and any
// future caches all reuse the same connection pool rather than spinning up
// several. StackExchange.Redis is designed to be used as a singleton.
var redisUrl = builder.Configuration["REDIS_URL"];
if (!string.IsNullOrWhiteSpace(redisUrl))
{
    var redisConfig = ConfigurationOptions.Parse(redisUrl);
    redisConfig.AbortOnConnectFail = false;
    redisConfig.ConnectRetry = 3;
    redisConfig.ConnectTimeout = 5000;
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConfig));
}

// SignalR scales horizontally only with a backplane. When REDIS_URL is provided
// (compose/k8s), route hub messages through Redis so clients on different core
// replicas see each other. Without it, SignalR falls back to in-process only
// and multi-replica deployments will lose real-time fan-out.
//
// Message size is capped tight (16 KiB) to cut off malicious oversize frames
// — trip/location payloads are small JSON docs. Handshakes get their own short
// timeout to limit slow-loris style abuse, and idle clients are pruned.
var signalR = builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 16 * 1024;
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.MaximumParallelInvocationsPerClient = 4;
    options.StreamBufferCapacity = 10;
});
if (!string.IsNullOrWhiteSpace(redisUrl))
{
    signalR.AddStackExchangeRedis(redisUrl, options =>
    {
        options.Configuration.ChannelPrefix = RedisChannel.Literal("atlas-core");
        options.Configuration.AbortOnConnectFail = false;
    });
}

var allowedOrigins = (builder.Configuration["CORE_ALLOWED_ORIGINS"] ?? builder.Configuration["CORE_FRONTEND_ORIGIN"] ?? string.Empty)
    .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Where(o => !string.IsNullOrWhiteSpace(o))
    .ToArray();

if (allowedOrigins.Length == 0 && builder.Environment.IsDevelopment())
{
    allowedOrigins = new[] { "http://localhost:5173", "http://localhost" };
}

if (allowedOrigins.Length == 0)
{
    throw new InvalidOperationException(
        "CORE_ALLOWED_ORIGINS (or CORE_FRONTEND_ORIGIN) must be configured to an explicit allowlist outside Development.");
}

builder.Services.AddCors(options => options.AddPolicy("default", policy => policy
    .WithOrigins(allowedOrigins)
    .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
    .WithHeaders("authorization", "content-type", "x-correlation-id")
    .AllowCredentials()));

// EF Core with DbContext pooling: reuses DbContext instances across requests
// so we skip allocating/initializing a fresh context (and its change tracker,
// model cache, etc.) on every hit. On hot endpoints this is a large p99 win.
// Retry-on-failure handles transient SQL failures (deadlocks, failover, network
// blips) before bubbling up, and CommandTimeout caps long-tail queries so one
// slow caller cannot tie up a connection-pool slot indefinitely.
// SplitQuery prevents cartesian-explosion JOINs on collections without every
// LINQ author remembering .AsSplitQuery() — verified against our schema.
var dbPoolSize = int.TryParse(builder.Configuration["CORE_DB_POOL_SIZE"], out var pool) && pool > 0 ? pool : 128;
builder.Services.AddDbContextPool<CoreDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("CoreDatabase")
            ?? builder.Configuration["CORE_DB_CONNECTION"]
            ?? (builder.Environment.IsDevelopment()
                ? "Server=(localdb)\\mssqllocaldb;Database=AtlasCore;Trusted_Connection=True;"
                : throw new InvalidOperationException("CoreDatabase connection string must be configured outside Development.")),
        sql =>
        {
            sql.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorNumbersToAdd: null);
            sql.CommandTimeout(30);
            sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
        }),
    poolSize: dbPoolSize);

// Response compression: Brotli (preferred) + Gzip fallback, for JSON/text/event
// streams. Static assets are served by nginx with its own pre-compressed store,
// but for API JSON responses this cuts payloads ~70% on typical trip/spot lists
// and pays for itself easily at the ~5ms CPU cost per 50KB response.
// Compression-for-HTTPS is enabled because nginx terminates TLS upstream; the
// BREACH mitigation is handled at the nginx layer via Vary: Cookie.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "application/json",
        "application/problem+json",
        "application/geo+json",
        "text/event-stream",
    });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

// Output caching: short, targeted response caching for idempotent reads. The
// base policy defaults to NoCache; endpoints opt in via [OutputCache]. We ship
// a named "short" policy (10s, varies by Authorization) that controllers can
// use on hot read paths (e.g. trip summaries) without leaking per-user state
// across tenants.
builder.Services.AddOutputCache(options =>
{
    options.AddBasePolicy(b => b.NoCache());
    options.AddPolicy("short", b => b
        .Expire(TimeSpan.FromSeconds(10))
        .SetVaryByHeader("Authorization", "Accept-Encoding"));
    options.AddPolicy("public-1m", b => b
        .Expire(TimeSpan.FromMinutes(1))
        .SetVaryByHeader("Accept-Encoding"));
});

// Distributed cache: when REDIS_URL is present, share cache across replicas
// (membership, rate-limit counters, session-scoped hot reads). Otherwise use
// in-process memory cache so the rest of the code can depend on
// IDistributedCache unconditionally. IMemoryCache is also registered for
// hot-path, single-replica-scoped caches (e.g. hashed password fast-path).
if (!string.IsNullOrWhiteSpace(redisUrl))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisUrl;
        options.InstanceName = "atlas-core:";
    });
}
else
{
    builder.Services.AddDistributedMemoryCache();
}
builder.Services.AddMemoryCache();

// JWT configuration: single source of truth shared by the token service (which
// signs tokens) and the JwtBearer authentication handler (which validates them).
// Env vars are CORE_JWT_* for historical compatibility; the options class lets
// any future Jwt:* config source also bind naturally.
var jwtOptions = new JwtOptions
{
    Secret = builder.Configuration["CORE_JWT_SECRET"] ?? string.Empty,
    Issuer = builder.Configuration["CORE_JWT_ISSUER"] ?? "atlas-core",
    Audience = builder.Configuration["CORE_JWT_AUDIENCE"] ?? "atlas-frontend",
    AccessTokenMinutes = int.TryParse(builder.Configuration["CORE_JWT_EXPIRATION_MINUTES"], out var accessMinutes) ? accessMinutes : 15,
    RefreshTokenDays = int.TryParse(builder.Configuration["CORE_JWT_REFRESH_DAYS"], out var refreshDays) ? refreshDays : 7,
};

if (string.IsNullOrWhiteSpace(jwtOptions.Secret))
{
    throw new InvalidOperationException("CORE_JWT_SECRET must be configured. Generate a 256-bit secret and supply it via environment or secret manager.");
}
if (Encoding.UTF8.GetByteCount(jwtOptions.Secret) < MinJwtSecretBytes)
{
    throw new InvalidOperationException($"CORE_JWT_SECRET must be at least {MinJwtSecretBytes} bytes (256 bits) of entropy.");
}

builder.Services.AddSingleton<IOptions<JwtOptions>>(Options.Create(jwtOptions));

builder.Services.AddOptions<RateLimitOptions>()
    .Bind(builder.Configuration.GetSection(RateLimitOptions.SectionName));

builder.Services.AddScoped<IPasswordHasher, PasswordHasherService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<IKafkaProducerService, KafkaProducerService>();
builder.Services.AddScoped<IAuthService, AuthService>();
// Outbound HTTP clients must always have a finite timeout so a slow content
// service can never stall a core request indefinitely and exhaust threads.
builder.Services.AddHttpClient("content", client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("atlas-core/1.0");
});
builder.Services.AddSingleton<ITripMembershipValidator, TripMembershipValidator>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret)),
            NameClaimType = "name",
            RoleClaimType = ClaimTypes.Role,
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
    if (app.Environment.IsDevelopment())
    {
        dbContext.Database.EnsureCreated();
    }
}

// Response compression must run before anything that writes to the body so
// the compressed filter wraps the response stream. Place it ahead of our
// logging/rate-limit middleware chain.
app.UseResponseCompression();

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<RateLimitMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
if (app.Environment.IsDevelopment() || string.Equals(app.Configuration["ENABLE_SWAGGER"], "true", StringComparison.OrdinalIgnoreCase))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/metrics"), branch =>
    branch.UseMiddleware<MetricsAllowlistMiddleware>());
app.UseCors("default");
app.UseAuthentication();
app.UseAuthorization();
// Output cache runs after auth so policies can vary by auth'd identity when
// they need to, and controllers can safely opt in via [OutputCache(...)].
app.UseOutputCache();
app.MapControllers();
app.MapMetrics("/metrics");
app.MapHub<Atlas.Core.API.Hubs.TripHub>("/api/core/hubs/trips");
app.MapHub<Atlas.Core.API.Hubs.LocationHub>("/api/core/hubs/location");
app.MapHub<Atlas.Core.API.Hubs.NotificationHub>("/api/core/hubs/notifications");
app.Run();

static Uri BuildOtlpTracesEndpoint(string endpoint)
{
    var normalized = endpoint.Trim().TrimEnd('/');
    if (!normalized.EndsWith("/v1/traces", StringComparison.OrdinalIgnoreCase))
    {
        normalized = $"{normalized}/v1/traces";
    }

    return new Uri(normalized, UriKind.Absolute);
}

public partial class Program { }
