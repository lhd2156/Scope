using System.Net;
using Atlas.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class ObservabilityEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly string SqlHost = Environment.GetEnvironmentVariable("CORE_TEST_SQL_SERVER_HOST") ?? "sqlserver";
    private static readonly string SqlPassword = Environment.GetEnvironmentVariable("SQL_SA_PASSWORD") ?? "Atlas_Dev_2026!";

    public ObservabilityEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("CORE_JWT_SECRET", "test-secret-test-secret-test-secret-test");
            builder.UseSetting("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092");
            builder.UseSetting("ConnectionStrings:CoreDatabase", $"Server={SqlHost},1433;Database=AtlasDb;User Id=sa;Password={SqlPassword};TrustServerCertificate=True");

            // Swap the SQL Server provider for an in-memory store so observability smoke tests
            // can run on CI runners without a live database. The real connection string above is
            // preserved for local/Docker-compose execution paths that do provide SQL Server.
            builder.ConfigureTestServices(services =>
            {
                var dbContextDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<CoreDbContext>));
                if (dbContextDescriptor is not null)
                {
                    services.Remove(dbContextDescriptor);
                }

                var dbContextServiceDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(CoreDbContext));
                if (dbContextServiceDescriptor is not null)
                {
                    services.Remove(dbContextServiceDescriptor);
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
        Assert.Contains("atlas_core_http_requests_total", body);
        Assert.Contains("route=\"/api/core/health\"", body);
        Assert.Contains("atlas_core_service_health", body);
    }
}
