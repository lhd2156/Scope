using System.Net;
using Scope.Core.API.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace Scope.Core.Tests.Middleware;

public sealed class RateLimitRedisCoverageTests
{
    [Fact]
    public async Task RateLimitMiddleware_UsesRedisCountersAndExpiresFirstHit()
    {
        var nextCalls = 0;
        var database = new Mock<IDatabase>();
        database.Setup(x => x.StringIncrementAsync(It.IsAny<RedisKey>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(1);
        database.Setup(x => x.KeyExpireAsync(It.IsAny<RedisKey>(), It.IsAny<TimeSpan?>(), It.IsAny<CommandFlags>()))
            .ReturnsAsync(true);
        var redis = Redis(database);
        var middleware = Middleware(redis.Object, _ =>
        {
            nextCalls += 1;
            return Task.CompletedTask;
        });

        var context = Context("/api/core/users/me", "203.0.113.80");

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.Equal(1, nextCalls);
        database.Verify(x => x.StringIncrementAsync(It.Is<RedisKey>(key => key.ToString().Contains("global:203.0.113.80")), 1, It.IsAny<CommandFlags>()), Times.Once);
        database.Verify(x => x.KeyExpireAsync(It.IsAny<RedisKey>(), It.IsAny<TimeSpan?>(), CommandFlags.FireAndForget), Times.Once);
    }

    [Fact]
    public async Task RateLimitMiddleware_FallsBackToLocalWhenRedisThrows()
    {
        var database = new Mock<IDatabase>();
        database.Setup(x => x.StringIncrementAsync(It.IsAny<RedisKey>(), It.IsAny<long>(), It.IsAny<CommandFlags>()))
            .ThrowsAsync(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "redis down"));
        var redis = Redis(database);
        var middleware = Middleware(redis.Object, _ => Task.CompletedTask);

        var context = Context("/api/core/users/me", "203.0.113.81");

        await middleware.InvokeAsync(context);

        Assert.NotEqual(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
    }

    private static RateLimitMiddleware Middleware(IConnectionMultiplexer redis, RequestDelegate next)
    {
        var services = new ServiceCollection().AddSingleton(redis).BuildServiceProvider();
        return new RateLimitMiddleware(
            next,
            NullLogger<RateLimitMiddleware>.Instance,
            Options.Create(new RateLimitOptions { AuthLimit = 5, RefreshLimit = 20, GlobalLimit = 5, WindowSeconds = 60, RetryAfterSeconds = "60" }),
            services);
    }

    private static Mock<IConnectionMultiplexer> Redis(Mock<IDatabase> database)
    {
        var redis = new Mock<IConnectionMultiplexer>();
        redis.SetupGet(x => x.IsConnected).Returns(true);
        redis.Setup(x => x.GetDatabase(It.IsAny<int>(), It.IsAny<object?>())).Returns(database.Object);
        return redis;
    }

    private static DefaultHttpContext Context(string path, string ip)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        return context;
    }
}
