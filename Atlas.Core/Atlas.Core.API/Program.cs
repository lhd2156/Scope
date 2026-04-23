using System.Security.Claims;
using System.Text;
using Atlas.Core.API.Middleware;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Prometheus;
using Serilog;
using Serilog.Formatting.Compact;

var builder = WebApplication.CreateBuilder(args);
Log.Logger = new LoggerConfiguration().WriteTo.Console(new RenderedCompactJsonFormatter()).CreateLogger();
builder.Host.UseSerilog();

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
builder.Services.AddSignalR();
builder.Services.AddCors(options => options.AddPolicy("default", policy => policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials().SetIsOriginAllowed(_ => true)));

builder.Services.AddDbContext<CoreDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("CoreDatabase") ?? builder.Configuration["CORE_DB_CONNECTION"] ?? "Server=(localdb)\\mssqllocaldb;Database=AtlasCore;Trusted_Connection=True;TrustServerCertificate=True;"));

builder.Services.AddScoped<IPasswordHasher, PasswordHasherService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<IKafkaProducerService, KafkaProducerService>();
builder.Services.AddScoped<IAuthService, AuthService>();

var secret = builder.Configuration["CORE_JWT_SECRET"] ?? "development-secret-development-secret";
var issuer = builder.Configuration["CORE_JWT_ISSUER"] ?? "atlas-core";
var audience = builder.Configuration["CORE_JWT_AUDIENCE"] ?? "atlas-frontend";
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = issuer,
            ValidAudience = audience,
            IssuerSigningKey = key,
            NameClaimType = "name",
            RoleClaimType = ClaimTypes.Role
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

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<RateLimitMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("default");
app.UseAuthentication();
app.UseAuthorization();
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
