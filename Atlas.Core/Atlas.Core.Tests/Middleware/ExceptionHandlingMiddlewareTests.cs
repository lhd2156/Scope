using System.Text.Json;
using Atlas.Core.API.Middleware;
using Atlas.Core.Domain.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text;
using Xunit;

namespace Atlas.Core.Tests.Middleware;

public sealed class ExceptionHandlingMiddlewareTests
{
    [Fact]
    public async Task AtlasException_ReturnsStandardErrorEnvelope()
    {
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new ConflictException("Duplicate friendship"),
            Mock.Of<ILogger<ExceptionHandlingMiddleware>>());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status409Conflict, context.Response.StatusCode);
        Assert.StartsWith("application/json", context.Response.ContentType, StringComparison.OrdinalIgnoreCase);
        using var document = await ReadJsonAsync(context);
        Assert.Equal("CONFLICT", document.RootElement.GetProperty("error").GetProperty("code").GetString());
        Assert.Equal("Duplicate friendship", document.RootElement.GetProperty("error").GetProperty("message").GetString());
        Assert.False(string.IsNullOrWhiteSpace(document.RootElement.GetProperty("error").GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task JsonException_ReturnsValidationErrorEnvelope()
    {
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new JsonException("Malformed JSON"),
            Mock.Of<ILogger<ExceptionHandlingMiddleware>>());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
        using var document = await ReadJsonAsync(context);
        Assert.Equal("VALIDATION_ERROR", document.RootElement.GetProperty("error").GetProperty("code").GetString());
        Assert.Equal("Invalid input data", document.RootElement.GetProperty("error").GetProperty("message").GetString());
    }

    [Fact]
    public async Task UnexpectedException_ReturnsInternalErrorEnvelope()
    {
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new InvalidOperationException("boom"),
            Mock.Of<ILogger<ExceptionHandlingMiddleware>>());
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        using var document = await ReadJsonAsync(context);
        Assert.Equal("INTERNAL_ERROR", document.RootElement.GetProperty("error").GetProperty("code").GetString());
        Assert.Equal("Unexpected server error", document.RootElement.GetProperty("error").GetProperty("message").GetString());
    }

    [Fact]
    public async Task StartedResponse_RethrowsOriginalException()
    {
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new InvalidOperationException("boom"),
            Mock.Of<ILogger<ExceptionHandlingMiddleware>>());
        var context = CreateContext(hasStarted: true);

        await Assert.ThrowsAsync<InvalidOperationException>(() => middleware.InvokeAsync(context));
    }

    private static DefaultHttpContext CreateContext(bool hasStarted = false)
    {
        var responseFeature = new TestHttpResponseFeature
        {
            Body = new MemoryStream(),
            HasStarted = hasStarted
        };
        var context = new DefaultHttpContext();
        context.Features.Set<IHttpResponseFeature>(responseFeature);
        context.Response.Body = responseFeature.Body;
        return context;
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        return JsonDocument.Parse(await new StreamReader(context.Response.Body).ReadToEndAsync());
    }

    private sealed class TestHttpResponseFeature : IHttpResponseFeature
    {
        public int StatusCode { get; set; } = StatusCodes.Status200OK;
        public string? ReasonPhrase { get; set; }
        public IHeaderDictionary Headers { get; set; } = new HeaderDictionary();
        public Stream Body { get; set; } = Stream.Null;
        public bool HasStarted { get; set; }

        public void OnStarting(Func<object, Task> callback, object state)
        {
        }

        public void OnCompleted(Func<object, Task> callback, object state)
        {
        }
    }
}
