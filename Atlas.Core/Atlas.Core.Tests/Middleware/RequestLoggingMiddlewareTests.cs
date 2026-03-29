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
    public async Task UsesIncomingCorrelationIdAndEnrichesStructuredLogEvent()
    {
        var sink = new CollectingSink();
        using var serilogLogger = new LoggerConfiguration()
            .ApplyCoreDefaults()
            .WriteTo.Sink(sink)
            .CreateLogger();
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddSerilog(serilogLogger, dispose: false));

        var middleware = new RequestLoggingMiddleware(context =>
        {
            context.Response.StatusCode = StatusCodes.Status204NoContent;
            return Task.CompletedTask;
        }, loggerFactory.CreateLogger<RequestLoggingMiddleware>());

        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Get;
        context.Request.Path = "/api/core/health";
        context.Request.Headers[CoreLogging.CorrelationIdHeaderName] = "corr-123";

        await middleware.InvokeAsync(context);

        Assert.Equal("corr-123", context.TraceIdentifier);
        Assert.Equal("corr-123", context.Response.Headers[CoreLogging.CorrelationIdHeaderName].ToString());

        var logEvent = Assert.Single(sink.Events);
        Assert.Equal("corr-123", GetScalarValue(logEvent, CoreLogging.CorrelationIdPropertyName));
        Assert.Equal("corr-123", GetScalarValue(logEvent, "TraceId"));
        Assert.Equal(CoreLogging.ServiceName, GetScalarValue(logEvent, CoreLogging.ServicePropertyName));
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
        Assert.Equal(generatedCorrelationId, GetScalarValue(Assert.Single(sink.Events), CoreLogging.CorrelationIdPropertyName));
    }

    private static string GetScalarValue(LogEvent logEvent, string propertyName)
        => Assert.IsType<ScalarValue>(logEvent.Properties[propertyName]).Value?.ToString() ?? string.Empty;

    private sealed class CollectingSink : ILogEventSink
    {
        public List<LogEvent> Events { get; } = [];

        public void Emit(LogEvent logEvent)
            => Events.Add(logEvent);
    }
}
