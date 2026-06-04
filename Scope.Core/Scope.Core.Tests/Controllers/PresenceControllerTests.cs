using System.Security.Claims;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class PresenceControllerTests
{
    [Fact]
    public async Task Heartbeat_StoresPlanningActivity()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(CreateUser(userId, "planner"));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);

        var result = await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "online", RouteContext: "/trips/new#ai", IsPlanning: true),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        Assert.NotNull(response.Data);

        var presence = await dbContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.Equal("planning", presence.Status);
        Assert.Equal("/trips/new#ai", presence.RouteContext);
        Assert.False(presence.IsIdle);
        Assert.NotNull(presence.LastPlanningAt);
    }

    [Fact]
    public async Task Heartbeat_IdleOverridesRequestedStatus()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(CreateUser(userId, "idle"));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);

        await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "planning", RouteContext: "/trips/new", IsIdle: true, IsPlanning: true),
            CancellationToken.None);

        var presence = await dbContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.Equal("idle", presence.Status);
        Assert.True(presence.IsIdle);
        Assert.NotNull(presence.LastPlanningAt);
    }

    private static CoreDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CoreDbContext(options);
    }

    private static User CreateUser(Guid userId, string username) => new()
    {
        Id = userId,
        Username = username,
        Email = $"{username}@example.com",
        DisplayName = username,
        PasswordHash = "hash",
        IsActive = true,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static PresenceController CreateController(CoreDbContext dbContext, Guid userId)
        => new(dbContext)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                    ], "test"))
                }
            }
        };
}
