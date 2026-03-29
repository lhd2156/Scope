using Atlas.Core.API.Logging;
using Atlas.Core.API.Middleware;
using Atlas.Core.Domain.Constants;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Xunit;

namespace Atlas.Core.Tests.Middleware;

public sealed class RequestLoggingMiddlewareTests
{
    [Fact]
    public async Task UsesIncomingCorrelationIdAndLogsRequestStartAndResponseCompletion()
    {
        var sink = new CollectingSink();
        using var serilogLogger = new LoggerConfiguration()
            .ApplyCoreDefaults()
            .WriteTo.Sink(sink)
            .CreateLogger();
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddSerilog(serilogLogger, dispose: false));

        var middleware = new RequestLoggingMiddleware(async context =>
        {
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"ok\":true}");
        }, loggerFactory.CreateLogger<RequestLoggingMiddleware>());

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/api/core/auth/login";
        context.Request.ContentType = "application/json";
        context.Request.ContentLength = 32;
        context.Request.Headers[CoreLogging.CorrelationIdHeaderName] = "corr-123";
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.Equal("corr-123", context.TraceIdentifier);
        Assert.Equal("corr-123", context.Response.Headers[CoreLogging.CorrelationIdHeaderName].ToString());

        Assert.Equal(2, sink.Events.Count);
        var requestStarted = sink.Events[0];
        var responseCompleted = sink.Events[1];

        Assert.Contains("HTTP request started", requestStarted.MessageTemplate.Text, StringComparison.Ordinal);
        Assert.Contains("HTTP response completed", responseCompleted.MessageTemplate.Text, StringComparison.Ordinal);

        Assert.Equal("corr-123", GetScalarValue(requestStarted, CoreLogging.CorrelationIdPropertyName));
        Assert.Equal("corr-123", GetScalarValue(requestStarted, CoreLogging.TraceIdPropertyName));
        Assert.Equal("POST", GetScalarValue(requestStarted, CoreLogging.MethodPropertyName));
        Assert.Equal("/api/core/auth/login", GetScalarValue(requestStarted, CoreLogging.PathPropertyName));
        Assert.Equal(CoreLogging.ServiceName, GetScalarValue(requestStarted, CoreLogging.ServicePropertyName));

        Assert.Equal("corr-123", GetScalarValue(responseCompleted, CoreLogging.CorrelationIdPropertyName));
        Assert.Equal("corr-123", GetScalarValue(responseCompleted, CoreLogging.TraceIdPropertyName));
        Assert.Equal("POST", GetScalarValue(responseCompleted, CoreLogging.MethodPropertyName));
        Assert.Equal("/api/core/auth/login", GetScalarValue(responseCompleted, CoreLogging.PathPropertyName));
        Assert.Equal("200", GetScalarValue(responseCompleted, CoreLogging.StatusCodePropertyName));
        Assert.Equal("application/json", GetScalarValue(responseCompleted, CoreLogging.RequestContentTypePropertyName));
        Assert.Equal("32", GetScalarValue(responseCompleted, CoreLogging.RequestContentLengthPropertyName));
        Assert.Equal("application/json", GetScalarValue(responseCompleted, CoreLogging.ResponseContentTypePropertyName));
        Assert.Equal("11", GetScalarValue(responseCompleted, CoreLogging.ResponseContentLengthPropertyName));
        Assert.True(GetLongValue(responseCompleted, CoreLogging.DurationMillisecondsPropertyName) >= 0);
    }

    [Fact]
    public async Task GeneratesCorrelationIdWhenIncomingHeaderIsMissingOrInvalid()
    {
        var sink = new CollectingSink();
        using var serilogLogger = new LoggerConfiguration()
            .ApplyCoreDefaults()
            .WriteTo.Sink(sink)
            .CreateLogger();
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddSerilog(serilogLogger, dispose: false));

        var middleware = new RequestLoggingMiddleware(context => Task.CompletedTask, loggerFactory.CreateLogger<RequestLoggingMiddleware>());

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = "/api/core/health";
        context.Request.Headers[CoreLogging.CorrelationIdHeaderName] = "\r\ninvalid";

        await middleware.InvokeAsync(context);

        var generatedCorrelationId = context.Response.Headers[CoreLogging.CorrelationIdHeaderName].ToString();
        Assert.False(string.IsNullOrWhiteSpace(generatedCorrelationId));
        Assert.Equal(generatedCorrelationId, context.TraceIdentifier);
        Assert.Equal(2, sink.Events.Count);
        Assert.Equal(generatedCorrelationId, GetScalarValue(sink.Events[0], CoreLogging.CorrelationIdPropertyName));
        Assert.Equal(generatedCorrelationId, GetScalarValue(sink.Events[1], CoreLogging.CorrelationIdPropertyName));
    }

    private static string GetScalarValue(LogEvent logEvent, string propertyName)
        => Assert.IsType<ScalarValue>(logEvent.Properties[propertyName]).Value?.ToString() ?? string.Empty;

    private static long GetLongValue(LogEvent logEvent, string propertyName)
        => Convert.ToInt64(Assert.IsType<ScalarValue>(logEvent.Properties[propertyName]).Value);

    private sealed class CollectingSink : ILogEventSink
    {
        public List<LogEvent> Events { get; } = [];

        public void Emit(LogEvent logEvent)
            => Events.Add(logEvent);
    }
}
