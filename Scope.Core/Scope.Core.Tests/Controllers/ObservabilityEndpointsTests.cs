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

public sealed class ObservabilityEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly string SqlHost = Environment.GetEnvironmentVariable("CORE_TEST_SQL_SERVER_HOST") ?? "sqlserver";
    private static readonly string SqlPassword = Environment.GetEnvironmentVariable("SQL_SA_PASSWORD") ?? "Scope_Dev_2026!";

    public ObservabilityEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("CORE_JWT_SECRET", "test-secret-test-secret-test-secret-test");
            builder.UseSetting("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092");
            builder.UseSetting("METRICS_ALLOW_UNKNOWN_REMOTE", "true");
            builder.UseSetting("METRICS_ALLOWED_CIDRS", "0.0.0.0/0,::/0");
            builder.UseSetting("ConnectionStrings:CoreDatabase", $"Server={SqlHost},1433;Database=ScopeDb;User Id=sa;Password={SqlPassword};TrustServerCertificate=True");

            // Swap the SQL Server provider for an in-memory store so observability smoke tests
            // can run on CI runners without a live database. The real connection string above is
            // preserved for local/Docker-compose execution paths that do provide SQL Server.
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
                    options.UseInMemoryDatabase($"observability-{Guid.NewGuid():N}"));
            });
        });
    }

    [Fact]
    public async Task MetricsEndpoint_ReturnsPrometheusPayload()
    {
        using var client = _factory.CreateClient();

        var healthResponse = await client.GetAsync("/api/core/health");
        var metricsResponse = await client.GetAsync("/metrics");
        var body = await metricsResponse.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, healthResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, metricsResponse.StatusCode);
        Assert.Contains("scope_core_http_requests_total", body);
        Assert.Contains("route=\"/api/core/health\"", body);
        Assert.Contains("scope_core_service_health", body);
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
