using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Atlas.Core.API;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;

namespace Atlas.Core.Tests.Infrastructure;

public class ApiTestWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string mediaRoot = Path.Combine(Path.GetTempPath(), "atlas-core-api-test-media");
    private readonly string databaseName = $"atlas-core-api-test-{Guid.NewGuid():N}";

    protected virtual string HostEnvironment => "Testing";

    protected virtual IReadOnlyDictionary<string, string?> AdditionalConfiguration => new Dictionary<string, string?>
    {
        [CoreConfigurationKeys.FrontendOrigin] = "https://atlas.example.com",
        [CoreConfigurationKeys.MediaRoot] = mediaRoot
    };

    public ApiTestWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.JwtSecret, new string('s', 64));
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.JwtIssuer, CoreDefaults.JwtIssuer);
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.JwtAudience, CoreDefaults.JwtAudience);
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.DatabaseConnection, "Server=(localdb)\\mssqllocaldb;Database=atlas_core_tests;Trusted_Connection=True;TrustServerCertificate=True");
        Environment.SetEnvironmentVariable(CoreConfigurationKeys.FrontendOrigin, "https://atlas.example.com");
        Directory.CreateDirectory(mediaRoot);
    }

    public HttpClient CreateAuthenticatedClient(Guid userId, string email = "louis@example.com", string displayName = "Louis Do", string role = CoreRoles.User)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", CreateAccessToken(userId, email, displayName, role));
        return client;
    }

    public string CreateAccessToken(Guid userId, string email = "louis@example.com", string displayName = "Louis Do", string role = CoreRoles.User)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtSecret)!));
        var token = new JwtSecurityToken(
            issuer: Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtIssuer) ?? CoreDefaults.JwtIssuer,
            audience: Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtAudience) ?? CoreDefaults.JwtAudience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, email),
                new Claim(CoreClaimTypes.DisplayName, displayName),
                new Claim(CoreClaimTypes.Roles, role),
                new Claim(ClaimTypes.Role, role)
            ],
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task SeedAsync(Action<CoreDbContext> seedAction)
    {
        await using var scope = Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        seedAction(dbContext);
        await dbContext.SaveChangesAsync();
    }

    public async Task SeedAsync(Func<CoreDbContext, Task> seedAction)
    {
        await using var scope = Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        await seedAction(dbContext);
        await dbContext.SaveChangesAsync();
    }

    public async Task<TResult> ExecuteDbContextAsync<TResult>(Func<CoreDbContext, Task<TResult>> action)
    {
        await using var scope = Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        return await action(dbContext);
    }

    protected virtual void ConfigureTestServices(IServiceCollection services)
    {
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(HostEnvironment);
        builder.ConfigureAppConfiguration((_, configurationBuilder) =>
        {
            var settings = new Dictionary<string, string?>(AdditionalConfiguration)
            {
                [CoreConfigurationKeys.JwtSecret] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtSecret),
                [CoreConfigurationKeys.JwtIssuer] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtIssuer),
                [CoreConfigurationKeys.JwtAudience] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.JwtAudience),
                [CoreConfigurationKeys.DatabaseConnection] = Environment.GetEnvironmentVariable(CoreConfigurationKeys.DatabaseConnection)
            };
            configurationBuilder.AddInMemoryCollection(settings);
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<CoreDbContext>>();
            services.RemoveAll<CoreDbContext>();
            services.AddDbContext<CoreDbContext>(options => options.UseInMemoryDatabase(databaseName));
            ConfigureTestServices(services);
        });
    }
}
