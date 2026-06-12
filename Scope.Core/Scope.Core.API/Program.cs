using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using Scope.Core.API.Configuration;
using Scope.Core.API.Middleware;
using Scope.Core.API.Services;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.AI;
using Scope.Core.Infrastructure.Configuration;
using Scope.Core.Infrastructure.Data;
using Scope.Core.Infrastructure.GrpcClients;
using Scope.Core.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Prometheus;
using Serilog;
using Serilog.Formatting.Compact;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
Log.Logger = new LoggerConfiguration().WriteTo.Console(new RenderedCompactJsonFormatter()).CreateLogger();
builder.Host.UseSerilog();
builder.WebHost.UseSentry(options =>
{
    var sentryRelease = builder.Configuration["SENTRY_RELEASE"];

    options.Dsn = StartupConfiguration.ResolveSentryDsn(builder.Configuration);
    options.TracesSampleRate = StartupConfiguration.ResolveSentryTracesSampleRate(builder.Configuration);
    options.Environment = StartupConfiguration.ResolveSentryEnvironment(builder.Configuration, builder.Environment);
    options.Release = StartupConfiguration.NullIfWhiteSpace(sentryRelease);
    options.SendDefaultPii = false;
});

// Kestrel limits — defense in depth alongside the nginx edge.
// - MaxRequestBodySize caps the worst-case ingest per request (2 MiB). Photo
//   uploads go to Content via nginx so core never handles large bodies.
// - Concurrent/queue limits protect against request floods before we reach
//   the rate limiter middleware; tune via KESTREL_* env vars.
builder.WebHost.ConfigureKestrel((context, options) =>
{
    var limits = StartupConfiguration.ResolveKestrelLimits(context.Configuration);
    StartupConfiguration.ApplyKestrelLimits(options, limits);

    // HTTP/2 tuning for high-concurrency SignalR + REST workloads. Behind
    // nginx we still speak HTTP/1.1 on the edge today, but Kestrel negotiates
    // H2 directly for any in-cluster calls (intel ↔ core, future gRPC) and
    // tests that connect straight to Kestrel. Raising the per-connection
    // stream cap + window sizes avoids head-of-line blocking when a single
    // client fires many parallel requests (common for the SPA fan-out on
    // load). Values mirror sane ASP.NET 8 defaults, tunable via env.
    // Concurrent connection caps: when set, connections above the limit are
    // queued rather than rejected, smoothing traffic spikes. Null (default)
    // means unlimited, which is fine behind nginx with its own limit_conn.
});

builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("scope-core"))
    .WithTracing(tracing =>
    {
        tracing.AddSource(ScopeObservability.ActivitySourceName);

        var otlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
        {
            tracing.AddOtlpExporter(options => options.Endpoint = StartupConfiguration.BuildOtlpTracesEndpoint(otlpEndpoint));
        }
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    ForwardedHeadersOptionsConfigurator.Configure(options, builder.Configuration);
});

// Shared Redis connection. A single IConnectionMultiplexer is registered when
// REDIS_URL is provided so that SignalR, the distributed rate limiter, and any
// future caches all reuse the same connection pool rather than spinning up
// several. StackExchange.Redis is designed to be used as a singleton.
var redisUrl = StartupConfiguration.NullIfWhiteSpace(builder.Configuration["REDIS_URL"]);
StartupConfiguration.AddRedisConnectionMultiplexerIfConfigured(builder.Services, redisUrl);

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
StartupConfiguration.AddSignalRRedisBackplaneIfConfigured(signalR, redisUrl);

var allowedOrigins = StartupConfiguration.ResolveAllowedOrigins(builder.Configuration, builder.Environment);

builder.Services.AddCors(options => options.AddPolicy("default", policy => policy
    .WithOrigins(allowedOrigins)
    .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
    .WithHeaders("authorization", "content-type", "x-correlation-id", "x-requested-with", "x-signalr-user-agent")
    .AllowCredentials()));

// EF Core with DbContext pooling: reuses DbContext instances across requests
// so we skip allocating/initializing a fresh context (and its change tracker,
// model cache, etc.) on every hit. On hot endpoints this is a large p99 win.
// Retry-on-failure handles transient SQL failures (deadlocks, failover, network
// blips) before bubbling up, and CommandTimeout caps long-tail queries so one
// slow caller cannot tie up a connection-pool slot indefinitely.
// SplitQuery prevents cartesian-explosion JOINs on collections without every
// LINQ author remembering .AsSplitQuery() — verified against our schema.
var coreDbConnection = StartupConfiguration.ResolveCoreDbConnection(builder.Configuration, builder.Environment);
var dbPoolSize = StartupConfiguration.ResolveCoreDbPoolSize(builder.Configuration);
builder.Services.AddDbContextPool<CoreDbContext>(options =>
    options.UseSqlServer(
        coreDbConnection,
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

var rateLimitOptions = builder.Configuration
    .GetSection(RateLimitOptions.SectionName)
    .Get<RateLimitOptions>() ?? new RateLimitOptions();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("global", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: StartupConfiguration.ResolveGlobalRateLimitPartitionKey(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = rateLimitOptions.GlobalLimit,
                Window = TimeSpan.FromSeconds(rateLimitOptions.WindowSeconds),
                QueueLimit = 20,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));

    options.AddPolicy("auth", httpContext =>
    {
        var partition = StartupConfiguration.ResolveAuthRateLimitPartition(httpContext, rateLimitOptions);

        return
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: partition.PartitionKey,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = partition.PermitLimit,
                Window = TimeSpan.FromSeconds(rateLimitOptions.WindowSeconds),
                QueueLimit = partition.QueueLimit,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            });
    });

    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.Headers["Retry-After"] = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            error = "Rate limit exceeded. Try again later.",
            retryAfterSeconds = 60,
        }, ct);
    };
});

// Distributed cache: when REDIS_URL is present, share cache across replicas
// (membership, rate-limit counters, session-scoped hot reads). Otherwise use
// in-process memory cache so the rest of the code can depend on
// IDistributedCache unconditionally. IMemoryCache is also registered for
// hot-path, single-replica-scoped caches (e.g. hashed password fast-path).
StartupConfiguration.AddDistributedCacheForRedis(builder.Services, redisUrl);
builder.Services.AddMemoryCache();

// JWT configuration: single source of truth shared by the token service (which
// signs tokens) and the JwtBearer authentication handler (which validates them).
// Env vars are CORE_JWT_* for historical compatibility; the options class lets
// any future Jwt:* config source also bind naturally.
var jwtOptions = StartupConfiguration.ResolveJwtOptions(builder.Configuration);
builder.Services.AddSingleton<IOptions<JwtOptions>>(Options.Create(jwtOptions));

builder.Services.AddOptions<RateLimitOptions>()
    .Bind(builder.Configuration.GetSection(RateLimitOptions.SectionName));

builder.Services.AddScoped<IPasswordHasher, PasswordHasherService>();
builder.Services.AddSingleton<IPasswordPolicy, PasswordPolicy>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<IKafkaProducerService, KafkaProducerService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();
builder.Services.AddScoped<IEmailVerificationService, EmailVerificationService>();
builder.Services.AddScoped<IMfaService, MfaService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<INotificationChannelSender, WebPushNotificationSender>();
builder.Services.AddScoped<INotificationChannelSender, NoopEmailNotificationSender>();
builder.Services.AddHostedService<NotificationEventConsumerService>();
builder.Services.AddHostedService<NotificationDeliveryDispatcher>();
builder.Services.AddHostedService<NotificationOutboxReplayDispatcher>();

// HIBP breach checker is opt-in via config. When disabled the null checker
// short-circuits so we don't pay for DI resolution of HttpClient, logger, etc.
builder.Services.AddOptions<HibpPasswordPolicyOptions>()
    .Bind(builder.Configuration.GetSection(HibpPasswordPolicyOptions.SectionName));
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient("hibp", client =>
{
    client.DefaultRequestHeaders.UserAgent.ParseAdd("scope-core-hibp/1.0");
});
if (StartupConfiguration.UseHibpPasswordBreachChecker(builder.Configuration))
{
    builder.Services.AddScoped<IPasswordBreachChecker, HibpPasswordBreachChecker>();
}
else
{
    builder.Services.AddSingleton<IPasswordBreachChecker, NullPasswordBreachChecker>();
}
// Outbound HTTP clients must always have a finite timeout so a slow content
// service can never stall a core request indefinitely and exhaust threads.
// The standard resilience handler layers retry + circuit breaker + per-attempt
// timeout on top. Rationale:
//   * Retry (3 attempts, jittered exponential backoff) — hides single-replica
//     blips (GC pause, rolling deploy) from the user.
//   * Circuit breaker — after a sustained failure rate, opens the circuit and
//     fails fast for 30s, sparing Core's thread pool when Content is hard
//     down. Half-open probes restore traffic when Content recovers.
//   * Per-attempt timeout (2s) — per-try, so a single stalled request can't
//     consume the whole 5s HttpClient timeout.
// Tuning is exposed via env so ops can widen the envelope during incidents.
var contentHttpTimeouts = StartupConfiguration.ResolveContentHttpTimeouts(builder.Configuration);
builder.Services.AddHttpClient("content", client =>
{
    client.Timeout = TimeSpan.FromSeconds(contentHttpTimeouts.TotalTimeoutSeconds);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("scope-core/1.0");
})
.AddStandardResilienceHandler(options =>
{
    // Attempt timeout: each individual try. Must be <= total timeout / attempts.
    options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(contentHttpTimeouts.AttemptTimeoutSeconds);

    // Retry policy: 3 attempts, exponential backoff w/ jitter. Only retries
    // transient status codes (408, 429, 5xx) and network errors by default.
    options.Retry.MaxRetryAttempts = contentHttpTimeouts.RetryAttempts;
    options.Retry.Delay = TimeSpan.FromMilliseconds(200);
    options.Retry.UseJitter = true;
    options.Retry.BackoffType = Polly.DelayBackoffType.Exponential;

    // Circuit breaker: trips when the failure ratio crosses the threshold
    // inside the sampling window AND enough samples have accumulated. Opens
    // the circuit for BreakDuration then half-opens to probe recovery.
    options.CircuitBreaker.FailureRatio = 0.5;
    options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
    options.CircuitBreaker.MinimumThroughput = 10;
    options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(contentHttpTimeouts.BreakDurationSeconds);

    // Total request timeout (across all retries). Slightly less than the
    // HttpClient timeout above so the handler owns the deadline rather than
    // letting the raw client cancel mid-retry.
    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(contentHttpTimeouts.HandlerTotalTimeoutSeconds);
});
builder.Services.AddSingleton<ITripMembershipValidator, TripMembershipValidator>();
var grpcInternalToken = StartupConfiguration.ResolveGrpcInternalToken(builder.Configuration, builder.Environment, jwtOptions.Secret);
builder.Services.AddSingleton(new ContentGrpcClient(
    builder.Configuration.GetValue<string>("CONTENT_GRPC_URL") ?? "http://content:50051",
    grpcInternalToken
));
var ollamaUrl = builder.Configuration["OLLAMA_BASE_URL"] ?? "http://ollama:11434";
var ollamaModel = builder.Configuration["OLLAMA_MODEL"] ?? "llama3.1";
builder.Services.AddSingleton(new ScopeAIService(ollamaUrl, ollamaModel));

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
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"].ToString();
                var path = context.HttpContext.Request.Path;

                context.Token = StartupConfiguration.ResolveHubAccessToken(accessToken, path) ?? context.Token;

                return Task.CompletedTask;
            },
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();
app.UseSentryTracing();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
    if (app.Environment.IsDevelopment())
    {
        dbContext.Database.EnsureCreated();
    }
}

app.UseForwardedHeaders();

// Response compression must run before anything that writes to the body so
// the compressed filter wraps the response stream. Place it ahead of our
// logging/rate-limit middleware chain.
app.UseResponseCompression();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<RateLimitMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
if (StartupConfiguration.ShouldUseSwagger(app.Configuration, app.Environment))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
if (StartupConfiguration.ShouldUseHstsAndHttpsRedirection(app.Environment))
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/metrics"), branch =>
    branch.UseMiddleware<MetricsAllowlistMiddleware>());
app.UseCors("default");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
// Output cache runs after auth so policies can vary by auth'd identity when
// they need to, and controllers can safely opt in via [OutputCache(...)].
app.UseOutputCache();
app.MapControllers();
app.MapMetrics("/metrics");
app.MapHub<Scope.Core.API.Hubs.TripHub>("/api/core/hubs/trips");
app.MapHub<Scope.Core.API.Hubs.LocationHub>("/api/core/hubs/location");
app.MapHub<Scope.Core.API.Hubs.NotificationHub>("/api/core/hubs/notifications");
app.Run();

public partial class Program { }
