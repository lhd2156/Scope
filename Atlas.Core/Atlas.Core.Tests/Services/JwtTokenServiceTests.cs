using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Atlas.Core.Tests.Services;

public sealed class JwtTokenServiceTests
{
    [Fact]
    public void CreateTokens_ThrowsWhenJwtSecretIsMissing()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        var service = new JwtTokenService(configuration);

        var exception = Assert.Throws<InvalidOperationException>(() => service.CreateTokens(BuildUser()));

        Assert.Equal($"{CoreConfigurationKeys.JwtSecret} must be configured.", exception.Message);
    }

    [Fact]
    public void CreateTokens_UsesArchitectureDefaultsWhenOptionalSettingsAreMissing()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [CoreConfigurationKeys.JwtSecret] = new string('s', 48)
            })
            .Build();
        var service = new JwtTokenService(configuration);
        var user = BuildUser();
        var issuedAt = DateTimeOffset.UtcNow;

        var tokenPair = service.CreateTokens(user);

        var token = new JwtSecurityTokenHandler().ReadJwtToken(tokenPair.AccessToken);
        Assert.Equal(CoreDefaults.JwtIssuer, token.Issuer);
        Assert.Equal(CoreDefaults.JwtAudience, Assert.Single(token.Audiences));
        Assert.Contains(token.Claims, claim => claim.Type == JwtRegisteredClaimNames.Sub && claim.Value == user.Id.ToString());
        Assert.Contains(token.Claims, claim => claim.Type == ClaimTypes.NameIdentifier && claim.Value == user.Id.ToString());
        Assert.Contains(token.Claims, claim => claim.Type == CoreClaimTypes.DisplayName && claim.Value == user.DisplayName);
        Assert.Contains(token.Claims, claim => claim.Type == ClaimTypes.Role && claim.Value == user.Role);
        Assert.InRange(
            tokenPair.ExpiresAt,
            issuedAt.AddMinutes(CoreDefaults.AccessTokenLifetimeMinutes).AddSeconds(-5),
            issuedAt.AddMinutes(CoreDefaults.AccessTokenLifetimeMinutes).AddSeconds(5));
    }

    private static User BuildUser()
        => new()
        {
            Id = Guid.NewGuid(),
            Email = "louis@example.com",
            DisplayName = "Louis",
            Role = CoreRoles.User
        };
}
