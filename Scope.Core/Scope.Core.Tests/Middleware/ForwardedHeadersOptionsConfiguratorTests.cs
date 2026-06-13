using System.Net;
using Scope.Core.API.Configuration;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Scope.Core.Tests.Middleware;

public sealed class ForwardedHeadersOptionsConfiguratorTests
{
    [Fact]
    public void Configure_PreservesLoopbackDefaultsWhenNoExplicitTrustListIsConfigured()
    {
        var options = new ForwardedHeadersOptions();
        var originalProxyCount = options.KnownProxies.Count;
        var originalNetworkCount = options.KnownNetworks.Count;

        ForwardedHeadersOptionsConfigurator.Configure(options, new ConfigurationBuilder().Build());

        Assert.Equal(ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, options.ForwardedHeaders);
        Assert.Equal(1, options.ForwardLimit);
        Assert.Equal(originalProxyCount, options.KnownProxies.Count);
        Assert.Equal(originalNetworkCount, options.KnownNetworks.Count);
    }

    [Fact]
    public void Configure_UsesExplicitTrustedProxiesAndNetworks()
    {
        var options = new ForwardedHeadersOptions();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [ForwardedHeadersOptionsConfigurator.KnownProxiesKey] = "127.0.0.1;::1",
            [ForwardedHeadersOptionsConfigurator.KnownNetworksKey] = "10.0.0.0/8,172.16.0.0/12,2001:db8::/32",
            [ForwardedHeadersOptionsConfigurator.ForwardLimitKey] = "2",
        }).Build();

        ForwardedHeadersOptionsConfigurator.Configure(options, configuration);

        Assert.Contains(IPAddress.Parse("127.0.0.1"), options.KnownProxies);
        Assert.Contains(IPAddress.Parse("::1"), options.KnownProxies);
        Assert.Equal(3, options.KnownNetworks.Count);
        Assert.Equal(2, options.ForwardLimit);
    }

    [Fact]
    public void Configure_RejectsInvalidTrustedNetworkConfiguration()
    {
        var options = new ForwardedHeadersOptions();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [ForwardedHeadersOptionsConfigurator.KnownNetworksKey] = "10.0.0.0/99",
        }).Build();

        var exception = Assert.Throws<InvalidOperationException>((Action)(() =>
            ForwardedHeadersOptionsConfigurator.Configure(options, configuration)));

        Assert.Contains(ForwardedHeadersOptionsConfigurator.KnownNetworksKey, exception.Message);
    }

    [Theory]
    [InlineData(ForwardedHeadersOptionsConfigurator.KnownProxiesKey, "not-an-ip")]
    [InlineData(ForwardedHeadersOptionsConfigurator.KnownNetworksKey, "10.0.0.0")]
    [InlineData(ForwardedHeadersOptionsConfigurator.KnownNetworksKey, "10.0.0.0/-1")]
    [InlineData(ForwardedHeadersOptionsConfigurator.KnownNetworksKey, "2001:db8::/129")]
    [InlineData(ForwardedHeadersOptionsConfigurator.ForwardLimitKey, "0")]
    [InlineData(ForwardedHeadersOptionsConfigurator.ForwardLimitKey, "many")]
    public void Configure_RejectsInvalidForwardedHeaderSettings(string key, string value)
    {
        var options = new ForwardedHeadersOptions();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [key] = value,
        }).Build();

        var exception = Assert.Throws<InvalidOperationException>((Action)(() =>
            ForwardedHeadersOptionsConfigurator.Configure(options, configuration)));

        Assert.Contains(key, exception.Message);
    }
}
