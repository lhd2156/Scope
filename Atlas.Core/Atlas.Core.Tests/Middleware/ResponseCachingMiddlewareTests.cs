using System.Security.Cryptography;
using System.Text;
using Atlas.Core.API.Middleware;
using Atlas.Core.Domain.Constants;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Atlas.Core.Tests.Middleware;

public sealed class ResponseCachingMiddlewareTests
{
    [Fact]
    public async Task MatchingIfNoneMatch_Returns304AndSetsEntityTagHeaders()
    {
        var payload = "{\"data\":{\"value\":1}}";
        var expectedEntityTag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload)))}\"";
        var middleware = new ResponseCachingMiddleware(async context =>
        {
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(payload);
        });

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = "/api/core/users/11111111-1111-1111-1111-111111111111";
        context.Request.Headers[CoreCaching.IfNoneMatchHeaderName] = expectedEntityTag;
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status304NotModified, context.Response.StatusCode);
        Assert.Equal(expectedEntityTag, context.Response.Headers[CoreCaching.EntityTagHeaderName].ToString());
        Assert.Equal(CoreCaching.CacheControlValue, context.Response.Headers[CoreCaching.CacheControlHeaderName].ToString());
        Assert.Contains(CoreCaching.VaryAuthorizationValue, context.Response.Headers[CoreCaching.VaryHeaderName].ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, context.Response.Body.Length);
    }

    [Fact]
    public async Task HealthEndpoint_IsExcludedFromEntityTagCaching()
    {
        var middleware = new ResponseCachingMiddleware(async context =>
        {
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"status\":\"healthy\"}");
        });

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = "/api/core/health";
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.False(context.Response.Headers.ContainsKey(CoreCaching.EntityTagHeaderName));
        context.Response.Body.Position = 0;
        Assert.Equal("{\"status\":\"healthy\"}", await new StreamReader(context.Response.Body).ReadToEndAsync());
    }

    [Fact]
    public async Task ExistingVaryHeader_IsPreservedWhenEntityTagCachingAddsAuthorizationVary()
    {
        var payload = "{\"data\":{\"value\":1}}";
        var middleware = new ResponseCachingMiddleware(async context =>
        {
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json";
            context.Response.Headers[CoreCaching.VaryHeaderName] = CoreCaching.VaryAcceptEncodingValue;
            await context.Response.WriteAsync(payload);
        });

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = "/api/core/users/11111111-1111-1111-1111-111111111111";
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        var varyHeader = context.Response.Headers[CoreCaching.VaryHeaderName].ToString();
        Assert.Contains(CoreCaching.VaryAcceptEncodingValue, varyHeader, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(CoreCaching.VaryAuthorizationValue, varyHeader, StringComparison.OrdinalIgnoreCase);
    }
}
