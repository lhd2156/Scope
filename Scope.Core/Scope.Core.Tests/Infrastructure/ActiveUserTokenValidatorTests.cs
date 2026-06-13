using System.Security.Claims;
using Scope.Core.API.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Infrastructure;

public sealed class ActiveUserTokenValidatorTests
{
    [Fact]
    public async Task IsActiveUserAsync_RequiresExistingActiveUser()
    {
        var activeUserId = Guid.NewGuid();
        var inactiveUserId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.AddRange(
            TestData.User(activeUserId, "active", isActive: true),
            TestData.User(inactiveUserId, "inactive", isActive: false));
        await dbContext.SaveChangesAsync();

        Assert.True(await ActiveUserTokenValidator.IsActiveUserAsync(Principal(ClaimTypes.NameIdentifier, activeUserId), dbContext, CancellationToken.None));
        Assert.False(await ActiveUserTokenValidator.IsActiveUserAsync(Principal("sub", inactiveUserId), dbContext, CancellationToken.None));
        Assert.False(await ActiveUserTokenValidator.IsActiveUserAsync(Principal("sub", Guid.NewGuid()), dbContext, CancellationToken.None));
        Assert.False(await ActiveUserTokenValidator.IsActiveUserAsync(new ClaimsPrincipal(), dbContext, CancellationToken.None));
    }

    private static ClaimsPrincipal Principal(string claimType, Guid userId)
        => new(new ClaimsIdentity(
        [
            new Claim(claimType, userId.ToString())
        ], "test"));
}
