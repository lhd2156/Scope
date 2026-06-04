using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class HealthPresenceCoveragePushTests
{
    [Fact]
    public async Task HealthController_ReportsRedisHealthyAndDegradedStates()
    {
        await using var dbContext = TestData.CreateDbContext();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["KAFKA_BOOTSTRAP_SERVERS"] = "kafka:9092",
        }).Build();

        var fastRedis = Redis(TimeSpan.FromMilliseconds(12));
        var healthy = new HealthController(dbContext, configuration, ServicesWithRedis(fastRedis.Object));

        var healthyResult = await healthy.Get(CancellationToken.None);

        var ok = Assert.IsType<ObjectResult>(healthyResult);
        Assert.Equal(StatusCodes.Status200OK, ok.StatusCode);
        Assert.Equal("healthy", TestData.Prop<string>(ok.Value!, "status"));

        var failingRedis = Redis(TimeSpan.Zero);
        failingRedis.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object?>())).Throws(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "redis down"));
        var degraded = new HealthController(dbContext, configuration, ServicesWithRedis(failingRedis.Object));

        var degradedResult = await degraded.Get(CancellationToken.None);

        var degradedObject = Assert.IsType<ObjectResult>(degradedResult);
        Assert.Equal(StatusCodes.Status200OK, degradedObject.StatusCode);
        Assert.Equal("degraded", TestData.Prop<string>(degradedObject.Value!, "status"));
    }

    [Fact]
    public async Task PresenceHeartbeat_UpdatesExistingPresenceAndDefaultsUnknownStatus()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.Add(TestData.User(userId, "presence"));
        dbContext.UserPresences.Add(new UserPresence
        {
            UserId = userId,
            Status = "offline",
            RouteContext = "/old",
            LastActiveAt = DateTimeOffset.UtcNow.AddHours(-1),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-1),
        });
        await dbContext.SaveChangesAsync();

        var controller = new PresenceController(dbContext).WithUser(userId);

        var result = await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "mystery", RouteContext: "   ", IsIdle: false, IsPlanning: false),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        var presence = await dbContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.Equal("online", presence.Status);
        Assert.Null(presence.RouteContext);
        Assert.False(presence.IsIdle);
        Assert.Null(presence.LastPlanningAt);
    }

    private static Mock<IConnectionMultiplexer> Redis(TimeSpan ping)
    {
        var database = new Mock<IDatabase>();
        database.Setup(x => x.PingAsync(It.IsAny<CommandFlags>())).ReturnsAsync(ping);
        var redis = new Mock<IConnectionMultiplexer>();
        redis.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object?>())).Returns(database.Object);
        return redis;
    }

    private static IServiceProvider ServicesWithRedis(IConnectionMultiplexer redis)
    {
        var services = new ServiceCollection();
        services.AddSingleton(redis);
        return services.BuildServiceProvider();
    }
}
