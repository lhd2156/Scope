using System.Net;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using Scope.Core.API.Middleware;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Scope.Core.Tests.Middleware;

public sealed class MiddlewareMoreTests
{
    [Fact]
    public async Task CorrelationIdMiddleware_EchoesSafeHeaderAndReplacesUnsafeValues()
    {
        var safe = new DefaultHttpContext();
        safe.Response.Body = new MemoryStream();
        safe.Request.Headers[CorrelationIdMiddleware.HeaderName] = "safe-id_123";
        var middleware = new CorrelationIdMiddleware(context => context.Response.WriteAsync("ok"), NullLogger<CorrelationIdMiddleware>.Instance);

        await middleware.InvokeAsync(safe);

        Assert.Equal("safe-id_123", safe.TraceIdentifier);
        Assert.Equal("safe-id_123", Assert.IsType<string>(safe.Items[CorrelationIdMiddleware.HeaderName]));

        var unsafeContext = new DefaultHttpContext();
        unsafeContext.Response.Body = new MemoryStream();
        unsafeContext.Request.Headers[CorrelationIdMiddleware.HeaderName] = "bad id with spaces";
        await middleware.InvokeAsync(unsafeContext);
        Assert.NotEqual("bad id with spaces", unsafeContext.TraceIdentifier);
        Assert.Equal(32, unsafeContext.TraceIdentifier.Length);
    }

    [Fact]
    public async Task ExceptionHandlingMiddleware_MapsScopeAndUnhandledExceptions()
    {
        var scopeContext = NewJsonContext();
        var scopeMiddleware = new ExceptionHandlingMiddleware(
            _ => throw new ValidationException("Bad input", [("field", "Nope")]),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await scopeMiddleware.InvokeAsync(scopeContext);

        Assert.Equal(StatusCodes.Status400BadRequest, scopeContext.Response.StatusCode);
        var scopeError = await ReadEnvelope(scopeContext);
        Assert.Equal("VALIDATION_ERROR", scopeError.Error.Code);
        Assert.Equal("field", Assert.Single(scopeError.Error.Details).Field);

        var unhandledContext = NewJsonContext();
        var unhandledMiddleware = new ExceptionHandlingMiddleware(
            _ => throw new InvalidOperationException("boom"),
            NullLogger<ExceptionHandlingMiddleware>.Instance);
        await unhandledMiddleware.InvokeAsync(unhandledContext);

        Assert.Equal(StatusCodes.Status500InternalServerError, unhandledContext.Response.StatusCode);
        Assert.Equal("INTERNAL_ERROR", (await ReadEnvelope(unhandledContext)).Error.Code);
    }

    [Fact]
    public async Task ExceptionHandlingMiddleware_MapsMalformedAndCanceledRequestsWithoutServerErrors()
    {
        var malformedContext = NewJsonContext();
        var malformedMiddleware = new ExceptionHandlingMiddleware(
            _ => throw new BadHttpRequestException("Unexpected end of request content."),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await malformedMiddleware.InvokeAsync(malformedContext);

        Assert.Equal(StatusCodes.Status400BadRequest, malformedContext.Response.StatusCode);
        Assert.Equal("BAD_REQUEST", (await ReadEnvelope(malformedContext)).Error.Code);

        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        var canceledContext = NewJsonContext();
        canceledContext.RequestAborted = cancellation.Token;
        var canceledMiddleware = new ExceptionHandlingMiddleware(
            _ => throw new OperationCanceledException(cancellation.Token),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await canceledMiddleware.InvokeAsync(canceledContext);

        Assert.Equal(ExceptionHandlingMiddleware.ClientClosedRequestStatusCode, canceledContext.Response.StatusCode);
        Assert.Equal(0, canceledContext.Response.Body.Length);

        var truncatedContext = NewJsonContext();
        truncatedContext.RequestAborted = cancellation.Token;
        var truncatedMiddleware = new ExceptionHandlingMiddleware(
            _ => throw new BadHttpRequestException("Unexpected end of request content."),
            NullLogger<ExceptionHandlingMiddleware>.Instance);

        await truncatedMiddleware.InvokeAsync(truncatedContext);

        Assert.Equal(ExceptionHandlingMiddleware.ClientClosedRequestStatusCode, truncatedContext.Response.StatusCode);
        Assert.Equal(0, truncatedContext.Response.Body.Length);
    }

    [Fact]
    public async Task MetricsAllowlistMiddleware_AllowsConfiguredNetworksUnknownAndBlocksOthers()
    {
        var called = 0;
        var middleware = new MetricsAllowlistMiddleware(
            _ =>
            {
                called += 1;
                return Task.CompletedTask;
            },
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["METRICS_ALLOWED_CIDRS"] = "203.0.113.0/24;bad-cidr",
                ["METRICS_ALLOW_UNKNOWN_REMOTE"] = "true",
            }).Build(),
            NullLogger<MetricsAllowlistMiddleware>.Instance);

        var allowed = new DefaultHttpContext();
        allowed.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.10");
        await middleware.InvokeAsync(allowed);
        Assert.Equal(1, called);

        var unknown = new DefaultHttpContext();
        await middleware.InvokeAsync(unknown);
        Assert.Equal(2, called);

        var blocked = new DefaultHttpContext();
        blocked.Connection.RemoteIpAddress = IPAddress.Parse("198.51.100.5");
        await middleware.InvokeAsync(blocked);
        Assert.Equal(StatusCodes.Status403Forbidden, blocked.Response.StatusCode);
        Assert.Equal(2, called);
    }

    [Fact]
    public async Task MetricsAllowlistMiddleware_AllowsDefaultPrivateRanges()
    {
        var called = 0;
        var middleware = new MetricsAllowlistMiddleware(
            _ =>
            {
                called += 1;
                return Task.CompletedTask;
            },
            new ConfigurationBuilder().Build(),
            NullLogger<MetricsAllowlistMiddleware>.Instance);

        await middleware.InvokeAsync(Context("/metrics", "127.0.0.1"));
        await middleware.InvokeAsync(Context("/metrics", "10.2.3.4"));

        Assert.Equal(2, called);
    }

    [Fact]
    public async Task MetricsAllowlistMiddleware_CoversMappedIpv4PartialMasksAndMalformedRanges()
    {
        var called = 0;
        var middleware = new MetricsAllowlistMiddleware(
            _ =>
            {
                called += 1;
                return Task.CompletedTask;
            },
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["METRICS_ALLOWED_CIDRS"] = "bad-cidr;999.0.0.1/24;203.0.113.0/nope;203.0.113.128/25",
            }).Build(),
            NullLogger<MetricsAllowlistMiddleware>.Instance);

        await middleware.InvokeAsync(Context("/metrics", "::ffff:203.0.113.130"));
        Assert.Equal(1, called);

        var mismatchedFamily = Context("/metrics", "::2");
        await middleware.InvokeAsync(mismatchedFamily);
        Assert.Equal(StatusCodes.Status403Forbidden, mismatchedFamily.Response.StatusCode);

        var outsidePartialMask = Context("/metrics", "203.0.113.10");
        await middleware.InvokeAsync(outsidePartialMask);
        Assert.Equal(StatusCodes.Status403Forbidden, outsidePartialMask.Response.StatusCode);

        var unknownRemote = NewJsonContext();
        await middleware.InvokeAsync(unknownRemote);
        Assert.Equal(StatusCodes.Status403Forbidden, unknownRemote.Response.StatusCode);
        Assert.Equal(1, called);
    }

    [Fact]
    public async Task RateLimitMiddleware_BypassesMetricsAndLimitsAuthAndGlobalBuckets()
    {
        var nextCalls = 0;
        var middleware = new RateLimitMiddleware(
            _ =>
            {
                nextCalls += 1;
                return Task.CompletedTask;
            },
            NullLogger<RateLimitMiddleware>.Instance,
            Options.Create(new RateLimitOptions { AuthLimit = 1, RefreshLimit = 3, GlobalLimit = 20, WindowSeconds = 60, RetryAfterSeconds = "9" }),
            new ServiceCollection().BuildServiceProvider());

        var metrics = Context("/metrics", "203.0.113.44");
        await middleware.InvokeAsync(metrics);
        Assert.Equal(1, nextCalls);

        await middleware.InvokeAsync(Context("/api/core/auth/login", "203.0.113.45"));
        var limitedAuth = Context("/api/core/auth/login", "203.0.113.45");
        await middleware.InvokeAsync(limitedAuth);
        Assert.Equal(StatusCodes.Status429TooManyRequests, limitedAuth.Response.StatusCode);
        Assert.Equal("9", limitedAuth.Response.Headers["Retry-After"].ToString());
        limitedAuth.Response.Body.Position = 0;
        var limitedBody = await new StreamReader(limitedAuth.Response.Body).ReadToEndAsync();
        Assert.Contains("\"error\"", limitedBody);
        Assert.Contains("\"code\":\"RATE_LIMITED\"", limitedBody);
        Assert.DoesNotContain("\"Error\"", limitedBody);

        var currentUser = Context("/api/core/auth/me", "203.0.113.45");
        await middleware.InvokeAsync(currentUser);
        Assert.NotEqual(StatusCodes.Status429TooManyRequests, currentUser.Response.StatusCode);

        await middleware.InvokeAsync(Context("/api/core/auth/refresh", "203.0.113.45"));
        await middleware.InvokeAsync(Context("/api/core/auth/refresh", "203.0.113.45"));
        var allowedRefresh = Context("/api/core/auth/refresh", "203.0.113.45");
        await middleware.InvokeAsync(allowedRefresh);
        Assert.NotEqual(StatusCodes.Status429TooManyRequests, allowedRefresh.Response.StatusCode);
        var limitedRefresh = Context("/api/core/auth/refresh", "203.0.113.45");
        await middleware.InvokeAsync(limitedRefresh);
        Assert.Equal(StatusCodes.Status429TooManyRequests, limitedRefresh.Response.StatusCode);

        var globalMiddleware = new RateLimitMiddleware(
            _ =>
            {
                nextCalls += 1;
                return Task.CompletedTask;
            },
            NullLogger<RateLimitMiddleware>.Instance,
            Options.Create(new RateLimitOptions { AuthLimit = 10, RefreshLimit = 20, GlobalLimit = 2, WindowSeconds = 60, RetryAfterSeconds = "9" }),
            new ServiceCollection().BuildServiceProvider());

        await globalMiddleware.InvokeAsync(Context("/api/core/users/me", "203.0.113.46"));
        await globalMiddleware.InvokeAsync(Context("/api/core/users/me", "203.0.113.46"));
        var limitedGlobal = Context("/api/core/users/me", "203.0.113.46");
        await globalMiddleware.InvokeAsync(limitedGlobal);
        Assert.Equal(StatusCodes.Status429TooManyRequests, limitedGlobal.Response.StatusCode);
    }

    [Fact]
    public void RateLimitMiddleware_LocalWindowExpiresOldEntriesAndLimitsCurrentOnes()
    {
        var store = new ConcurrentDictionary<string, Queue<DateTimeOffset>>();
        var key = $"test:{Guid.NewGuid()}";
        var now = DateTimeOffset.UtcNow;
        store[key] = new Queue<DateTimeOffset>(
        [
            now.AddSeconds(-61),
            now.AddSeconds(-61),
            now.AddSeconds(-1),
        ]);

        Assert.True(PermitLocal(store, key, now, limit: 2, TimeSpan.FromSeconds(60)));
        Assert.False(PermitLocal(store, key, now, limit: 2, TimeSpan.FromSeconds(60)));

        var emptyKey = $"empty:{Guid.NewGuid()}";
        Assert.True(PermitLocal(store, emptyKey, now, limit: 1, TimeSpan.FromSeconds(60)));
    }

    [Fact]
    public async Task RequestLoggingMiddleware_RecordsSuccessAndRethrowsFailures()
    {
        var success = Context("/api/core/users/me", "203.0.113.47");
        success.Request.Method = "GET";
        success.Response.StatusCode = StatusCodes.Status202Accepted;
        var middleware = new RequestLoggingMiddleware(_ => Task.CompletedTask, NullLogger<RequestLoggingMiddleware>.Instance);

        await middleware.InvokeAsync(success);

        var failure = Context("/api/core/users/me", "203.0.113.48");
        failure.Request.Method = "POST";
        var throwing = new RequestLoggingMiddleware(_ => throw new InvalidOperationException("boom"), NullLogger<RequestLoggingMiddleware>.Instance);
        await Assert.ThrowsAsync<InvalidOperationException>(() => throwing.InvokeAsync(failure));

        var serverError = Context("/api/core/trips", "203.0.113.49");
        serverError.Request.Method = "PATCH";
        serverError.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        await middleware.InvokeAsync(serverError);
    }

    [Fact]
    public async Task RequestLoggingMiddleware_TagsActivityForSuccessAndThrownFailure()
    {
        using var listener = new ActivityListener
        {
            ShouldListenTo = source => source.Name == ScopeObservability.ActivitySourceName,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
        };
        ActivitySource.AddActivityListener(listener);

        var success = Context("/api/core/health", "203.0.113.50");
        success.Request.Method = "GET";
        success.Request.Headers["X-Correlation-Id"] = "corr-123";
        success.Response.StatusCode = StatusCodes.Status204NoContent;
        var middleware = new RequestLoggingMiddleware(_ => Task.CompletedTask, NullLogger<RequestLoggingMiddleware>.Instance);

        await middleware.InvokeAsync(success);

        var failure = Context("/api/core/health", "203.0.113.51");
        failure.Request.Method = "DELETE";
        var throwing = new RequestLoggingMiddleware(_ => throw new InvalidOperationException("activity boom"), NullLogger<RequestLoggingMiddleware>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => throwing.InvokeAsync(failure));
    }

    [Fact]
    public void ScopeObservability_ResolvesEndpointRoutesAndNormalizesFallbackPaths()
    {
        var endpointContext = NewJsonContext();
        endpointContext.SetEndpoint(new RouteEndpoint(
            _ => Task.CompletedTask,
            RoutePatternFactory.Parse("api/core/users/{id:guid}"),
            order: 0,
            EndpointMetadataCollection.Empty,
            displayName: "user route"));

        Assert.Equal("/api/core/users/{id:guid}", ScopeObservability.ResolveRoute(endpointContext));

        var emptyPath = NewJsonContext();
        emptyPath.Request.Path = PathString.Empty;
        Assert.Equal("/", ScopeObservability.ResolveRoute(emptyPath));

        var rootedPath = NewJsonContext();
        rootedPath.Request.Path = "/api/core/health";
        Assert.Equal("/api/core/health", ScopeObservability.ResolveRoute(rootedPath));
    }

    private static DefaultHttpContext Context(string path, string ip)
    {
        var context = NewJsonContext();
        context.Request.Path = path;
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        return context;
    }

    private static DefaultHttpContext NewJsonContext()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static async Task<ErrorEnvelope> ReadEnvelope(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return (await JsonSerializer.DeserializeAsync<ErrorEnvelope>(
            context.Response.Body,
            new JsonSerializerOptions(JsonSerializerDefaults.Web)))!;
    }

    private static bool PermitLocal(
        ConcurrentDictionary<string, Queue<DateTimeOffset>> store,
        string key,
        DateTimeOffset now,
        int limit,
        TimeSpan window)
    {
        var method = typeof(RateLimitMiddleware).GetMethod("PermitLocal", BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new MissingMethodException(nameof(RateLimitMiddleware), "PermitLocal");
        return (bool)method.Invoke(null, [store, key, now, limit, window])!;
    }
}
