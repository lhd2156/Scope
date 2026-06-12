using System.Net;
using System.Net.Http;
using Scope.Core.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class HibpPasswordBreachCheckerTests
{
    [Fact]
    public async Task IsBreachedAsync_ReturnsFalse_WhenDisabled()
    {
        var options = Options.Create(new HibpPasswordPolicyOptions { Enabled = false });
        var httpFactory = new Mock<IHttpClientFactory>();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var sut = new HibpPasswordBreachChecker(httpFactory.Object, cache, options);

        Assert.False(await sut.IsBreachedAsync("anything"));
    }

    [Fact]
    public async Task IsBreachedAsync_ReturnsTrue_WhenSuffixPresent()
    {
        // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
        // Prefix: 5BAA6, Suffix: 1E4C9B93F3F0682250B6CF8331B7EE68FD8
        var payload = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:12345\r\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1";
        var handler = new Mock<HttpMessageHandler>();
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(payload) });
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient("hibp")).Returns(new HttpClient(handler.Object));
        var options = Options.Create(new HibpPasswordPolicyOptions { Enabled = true, BreachThreshold = 1 });
        var sut = new HibpPasswordBreachChecker(factory.Object, new MemoryCache(new MemoryCacheOptions()), options);

        Assert.True(await sut.IsBreachedAsync("password"));
    }

    [Fact]
    public async Task IsBreachedAsync_FailsOpen_OnHttpError()
    {
        var handler = new Mock<HttpMessageHandler>();
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("network down"));
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient("hibp")).Returns(new HttpClient(handler.Object));
        var options = Options.Create(new HibpPasswordPolicyOptions { Enabled = true });
        var sut = new HibpPasswordBreachChecker(factory.Object, new MemoryCache(new MemoryCacheOptions()), options);

        Assert.False(await sut.IsBreachedAsync("password"));
    }

    [Fact]
    public async Task IsBreachedAsync_ReturnsFalseForEmptyPayloadMalformedLinesAndBelowThreshold()
    {
        Assert.False(await CheckerWithPayload(string.Empty).IsBreachedAsync("password"));
        Assert.False(await CheckerWithPayload("not-a-suffix-line\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1").IsBreachedAsync("password"));
        Assert.False(await CheckerWithPayload("1E4C9B93F3F0682250B6CF8331B7EE68FD8:4", breachThreshold: 5).IsBreachedAsync("password"));
        Assert.False(await CheckerWithPayload("1E4C9B93F3F0682250B6CF8331B7EE68FD8:not-a-number").IsBreachedAsync("password"));
    }

    [Fact]
    public async Task IsBreachedAsync_CachesPrefixPayloadAndSkipsBlankPasswords()
    {
        var calls = 0;
        var handler = new Mock<HttpMessageHandler>();
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() =>
            {
                calls += 1;
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("1E4C9B93F3F0682250B6CF8331B7EE68FD8:999")
                };
            });
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient("hibp")).Returns(new HttpClient(handler.Object));
        var sut = new HibpPasswordBreachChecker(
            factory.Object,
            new MemoryCache(new MemoryCacheOptions()),
            Options.Create(new HibpPasswordPolicyOptions { Enabled = true, BreachThreshold = 1, CacheSeconds = 60 }));

        Assert.False(await sut.IsBreachedAsync(string.Empty));
        Assert.True(await sut.IsBreachedAsync("password"));
        Assert.True(await sut.IsBreachedAsync("password"));
        Assert.Equal(1, calls);
    }

    private static HibpPasswordBreachChecker CheckerWithPayload(string payload, int breachThreshold = 1)
    {
        var handler = new Mock<HttpMessageHandler>();
        handler.Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(payload) });
        var factory = new Mock<IHttpClientFactory>();
        factory.Setup(x => x.CreateClient("hibp")).Returns(new HttpClient(handler.Object));
        return new HibpPasswordBreachChecker(
            factory.Object,
            new MemoryCache(new MemoryCacheOptions()),
            Options.Create(new HibpPasswordPolicyOptions { Enabled = true, BreachThreshold = breachThreshold }));
    }
}
