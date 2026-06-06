using System.Security.Claims;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.Data.Sqlite;
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

    [Fact]
    public async Task Heartbeat_AllowsConcurrentFirstHeartbeats()
    {
        var userId = Guid.NewGuid();
        var connectionString = $"Data Source=file:presence-{Guid.NewGuid():N};Mode=Memory;Cache=Shared;Default Timeout=30";
        await using var keepAliveConnection = new SqliteConnection(connectionString);
        await keepAliveConnection.OpenAsync();
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseSqlite(connectionString)
            .Options;

        await using (var setupContext = new CoreDbContext(options))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.Users.Add(CreateUser(userId, "race"));
            await setupContext.SaveChangesAsync();
        }

        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, 6)
            .Select(async index =>
            {
                await using var requestContext = new CoreDbContext(options);
                var controller = CreateController(requestContext, userId);

                await start.Task;
                return await controller.Heartbeat(
                    new PresenceHeartbeatRequest(Status: index % 2 == 0 ? "online" : "planning", RouteContext: "/map", IsIdle: false, IsPlanning: index % 2 == 1),
                    CancellationToken.None);
            })
            .ToArray();

        start.SetResult();
        var results = await Task.WhenAll(tasks);

        Assert.All(results, result => Assert.IsType<OkObjectResult>(result));
        await using var verifyContext = new CoreDbContext(options);
        var presence = await verifyContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.True(presence.Status is "online" or "planning", $"Unexpected status: {presence.Status}");
        Assert.Equal("/map", presence.RouteContext);
    }

    [Fact]
    public async Task Heartbeat_CapsRouteContextToStoredLength()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(CreateUser(userId, "route"));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);
        var longRoute = "/" + new string('x', 220);

        await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "online", RouteContext: longRoute, IsIdle: false, IsPlanning: false),
            CancellationToken.None);

        var presence = await dbContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.NotNull(presence.RouteContext);
        Assert.Equal(160, presence.RouteContext.Length);
        Assert.Equal(longRoute[..160], presence.RouteContext);
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
