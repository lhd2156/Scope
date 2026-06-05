using System.Net;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class CorsPolicyTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string ProductionFrontendOrigin = "https://app.scopetrips.com";
    private readonly WebApplicationFactory<Program> _factory;

    public CorsPolicyTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("CORE_ALLOWED_ORIGINS", ProductionFrontendOrigin);
            builder.UseSetting("CORE_JWT_SECRET", "test-secret-test-secret-test-secret-test");
            builder.UseSetting("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092");
            builder.UseSetting("ConnectionStrings:CoreDatabase", "Server=localhost;Database=ScopeDb;User Id=sa;Password=CHANGE_ME_STRONG_PASSWORD!;TrustServerCertificate=True");

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<CoreDbContext>();
                services.RemoveAll<DbContextOptions<CoreDbContext>>();

                foreach (var descriptor in services
                             .Where(IsCoreDbContextInfrastructure)
                             .ToList())
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<CoreDbContext>(options =>
                    options.UseInMemoryDatabase($"cors-{Guid.NewGuid():N}"));
            });
        });
    }

    [Fact]
    public async Task SignalRNegotiatePreflight_AllowsBrowserSignalRHeaders()
    {
        using var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Options,
            "/api/core/hubs/notifications/negotiate?negotiateVersion=1");
        request.Headers.Add("Origin", ProductionFrontendOrigin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "authorization,x-requested-with,x-signalr-user-agent");

        var response = await client.SendAsync(request);
        var headers = response.Headers.ToDictionary(
            header => header.Key,
            header => string.Join(",", header.Value),
            StringComparer.OrdinalIgnoreCase);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(ProductionFrontendOrigin, headers["Access-Control-Allow-Origin"]);
        Assert.Equal("true", headers["Access-Control-Allow-Credentials"]);

        var allowedHeaders = headers["Access-Control-Allow-Headers"].ToLowerInvariant();
        Assert.Contains("authorization", allowedHeaders);
        Assert.Contains("x-requested-with", allowedHeaders);
        Assert.Contains("x-signalr-user-agent", allowedHeaders);
    }

    private static bool IsCoreDbContextInfrastructure(ServiceDescriptor descriptor)
    {
        return ReferencesCoreDbContext(descriptor.ServiceType)
            || ReferencesCoreDbContext(descriptor.ImplementationType);
    }

    private static bool ReferencesCoreDbContext(Type? type)
    {
        if (type is null)
        {
            return false;
        }

        if (type == typeof(CoreDbContext))
        {
            return true;
        }

        if (type.IsGenericType && type.GetGenericArguments().Any(argument => argument == typeof(CoreDbContext)))
        {
            return true;
        }

        return type.FullName?.Contains("CoreDbContext", StringComparison.Ordinal) == true;
    }
}
