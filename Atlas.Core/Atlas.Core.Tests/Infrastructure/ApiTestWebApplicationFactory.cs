using Atlas.Core.API;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Atlas.Core.Tests.Infrastructure;

public sealed class ApiTestWebApplicationFactory : WebApplicationFactory<Program>
{
    public ApiTestWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.JwtSecret, new string('s', 64));
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.JwtIssuer, CoreDefaults.JwtIssuer);
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.JwtAudience, CoreDefaults.JwtAudience);
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.DatabaseConnection, "Server=(localdb)\\mssqllocaldb;Database=atlas_core_tests;Trusted_Connection=True;TrustServerCertificate=True");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configurationBuilder) =>
        {
            configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                [CoreConfigurationKeys.JwtSecret] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtSecret),
                [CoreConfigurationKeys.JwtIssuer] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtIssuer),
                [CoreConfigurationKeys.JwtAudience] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtAudience),
                [CoreConfigurationKeys.DatabaseConnection] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.DatabaseConnection)
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<CoreDbContext>>();
            services.RemoveAll<CoreDbContext>();
            services.AddDbContext<CoreDbContext>(options => options.UseInMemoryDatabase($"atlas-core-auth-{Guid.NewGuid():N}"));
        });
    }
}
