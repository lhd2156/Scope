using System.Net;
using Atlas.Core.API.Middleware;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Atlas.Core.Tests.Middleware;

public sealed class RateLimitMiddlewareTests
{
    [Fact]
    public async Task AuthEndpoints_AreLimitedToTenRequestsPerMinutePerIp()
    {
        var callCount = 0;
        var middleware = new RateLimitMiddleware(_ =>
        {
            callCount++;
            return Task.CompletedTask;
        });

        for (var requestIndex = 0; requestIndex < 10; requestIndex++)
        {
            var context = await InvokeAsync(middleware, "/api/core/auth/login", "203.0.113.10");
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode == 0 ? StatusCodes.Status200OK : context.Response.StatusCode);
        }

        var blockedContext = await InvokeAsync(middleware, "/api/core/auth/login", "203.0.113.10");

        Assert.Equal(10, callCount);
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedContext.Response.StatusCode);
        Assert.NotEmpty(blockedContext.Response.Headers["Retry-After"].ToString());
        blockedContext.Response.Body.Position = 0;
        var body = await new StreamReader(blockedContext.Response.Body).ReadToEndAsync();
        Assert.Contains("RATE_LIMITED", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task NonAuthApiEndpoints_UseTheGlobalLimit()
    {
        var callCount = 0;
        var middleware = new RateLimitMiddleware(_ =>
        {
            callCount++;
            return Task.CompletedTask;
        });

        for (var requestIndex = 0; requestIndex < 100; requestIndex++)
        {
            var context = await InvokeAsync(middleware, "/api/core/notifications", "203.0.113.11");
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode == 0 ? StatusCodes.Status200OK : context.Response.StatusCode);
        }

        var blockedContext = await InvokeAsync(middleware, "/api/core/notifications", "203.0.113.11");

        Assert.Equal(100, callCount);
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedContext.Response.StatusCode);
        Assert.NotEmpty(blockedContext.Response.Headers["Retry-After"].ToString());
    }

    [Fact]
    public async Task HubNegotiationRequests_AreAlsoCoveredByTheGlobalLimit()
    {
        var callCount = 0;
        var middleware = new RateLimitMiddleware(_ =>
        {
            callCount++;
            return Task.CompletedTask;
        });

        for (var requestIndex = 0; requestIndex < 100; requestIndex++)
        {
            var context = await InvokeAsync(middleware, "/api/core/hubs/notifications/negotiate", "203.0.113.12");
            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode == 0 ? StatusCodes.Status200OK : context.Response.StatusCode);
        }

        var blockedContext = await InvokeAsync(middleware, "/api/core/hubs/notifications/negotiate", "203.0.113.12");

        Assert.Equal(100, callCount);
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedContext.Response.StatusCode);
        Assert.NotEmpty(blockedContext.Response.Headers["Retry-After"].ToString());
    }

    private static async Task<DefaultHttpContext> InvokeAsync(RateLimitMiddleware middleware, string path, string ipAddress)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Connection.RemoteIpAddress = IPAddress.Parse(ipAddress);
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);
        return context;
    }
}
