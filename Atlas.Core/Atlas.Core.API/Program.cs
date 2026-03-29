using System.Security.Claims;
using System.Text;
using Atlas.Core.API.Contracts.Validators;
using Atlas.Core.API.Middleware;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Infrastructure.Services;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Formatting.Compact;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(new RenderedCompactJsonFormatter())
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var details = context.ModelState
                .Where(entry => entry.Value?.Errors.Count > 0)
                .SelectMany(entry => entry.Value!.Errors.Select(error => new ErrorDetail(entry.Key, string.IsNullOrWhiteSpace(error.ErrorMessage) ? "Invalid value" : error.ErrorMessage)))
                .ToArray();

            return new BadRequestObjectResult(new ErrorEnvelope(new ErrorBody("VALIDATION_ERROR", "Invalid input data", details, context.HttpContext.TraceIdentifier)));
        };
    });

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

var allowedOrigins = BuildAllowedOrigins(builder.Configuration, builder.Environment);
builder.Services.AddCors(options => options.AddPolicy(CoreDefaults.CorsPolicyName, policy =>
    policy.WithOrigins(allowedOrigins)
        .WithHeaders("Authorization", "Content-Type")
        .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .AllowCredentials()));

builder.Services.AddDbContext<CoreDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default")
        ?? builder.Configuration["CORE_ConnectionStrings__Default"]
        ?? builder.Configuration[CoreConfigurationKeys.DatabaseConnection]
        ?? throw new InvalidOperationException("A core database connection string must be configured via ConnectionStrings:Default or CORE_DB_CONNECTION.")));

builder.Services.AddScoped<IPasswordHasher, PasswordHasherService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IKafkaProducerService, KafkaProducerService>();
builder.Services.AddScoped<IAvatarStorageService, S3Service>();
builder.Services.AddScoped<IAuthService, AuthService>();

var secret = builder.Configuration[CoreConfigurationKeys.JwtSecret];
if (string.IsNullOrWhiteSpace(secret))
{
    throw new InvalidOperationException($"{CoreConfigurationKeys.JwtSecret} must be configured.");
}

var issuer = builder.Configuration[CoreConfigurationKeys.JwtIssuer] ?? CoreDefaults.JwtIssuer;
var audience = builder.Configuration[CoreConfigurationKeys.JwtAudience] ?? CoreDefaults.JwtAudience;
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
            NameClaimType = CoreClaimTypes.DisplayName,
            RoleClaimType = ClaimTypes.Role
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/api/core/hubs"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<RateLimitMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSwagger();
app.UseSwaggerUI();
app.UseStaticFiles();
app.UseCors(CoreDefaults.CorsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<Atlas.Core.API.Hubs.TripHub>("/api/core/hubs/trips");
app.MapHub<Atlas.Core.API.Hubs.LocationHub>("/api/core/hubs/location");
app.MapHub<Atlas.Core.API.Hubs.NotificationHub>("/api/core/hubs/notifications");
app.Run();

return;

static string[] BuildAllowedOrigins(ConfigurationManager configuration, IWebHostEnvironment environment)
{
    var configuredOrigin = configuration[CoreConfigurationKeys.FrontendOrigin]?.Trim();
    var origins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    if (!string.IsNullOrWhiteSpace(configuredOrigin))
    {
        origins.Add(configuredOrigin);
    }

    if (environment.IsDevelopment())
    {
        origins.Add(CoreDefaults.DevelopmentFrontendOrigin);
    }

    if (origins.Count == 0)
    {
        throw new InvalidOperationException($"{CoreConfigurationKeys.FrontendOrigin} must be configured outside Development.");
    }

    return origins.ToArray();
}

public partial class Program { }
