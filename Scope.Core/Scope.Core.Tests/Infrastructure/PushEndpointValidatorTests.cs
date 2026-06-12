using System.Net;
using System.Reflection;
using Scope.Core.API.Controllers;
using Xunit;

namespace Scope.Core.Tests.Infrastructure;

public sealed class PushEndpointValidatorTests
{
    private static readonly MethodInfo IsAllowedMethod = typeof(NotificationsController).Assembly
        .GetType("Scope.Core.API.Infrastructure.PushEndpointValidator", throwOnError: true)!
        .GetMethod("IsAllowedAsync", BindingFlags.Public | BindingFlags.Static)!;

    private static readonly MethodInfo IsPublicAddressMethod = typeof(NotificationsController).Assembly
        .GetType("Scope.Core.API.Infrastructure.PushEndpointValidator", throwOnError: true)!
        .GetMethod("IsPublicAddress", BindingFlags.NonPublic | BindingFlags.Static)!;

    [Theory]
    [InlineData("https://1.1.1.1/push", true)]
    [InlineData("https://8.8.8.8/push", true)]
    [InlineData("https://[2606:4700:4700::1111]/push", true)]
    [InlineData("https://0.1.2.3/push", false)]
    [InlineData("https://10.0.0.5/push", false)]
    [InlineData("https://100.64.0.1/push", false)]
    [InlineData("https://127.0.0.1/push", false)]
    [InlineData("https://169.254.10.20/push", false)]
    [InlineData("https://172.16.1.2/push", false)]
    [InlineData("https://192.168.1.2/push", false)]
    [InlineData("https://192.0.0.1/push", false)]
    [InlineData("https://192.0.2.1/push", false)]
    [InlineData("https://198.18.0.1/push", false)]
    [InlineData("https://198.19.0.1/push", false)]
    [InlineData("https://198.51.100.1/push", false)]
    [InlineData("https://203.0.113.1/push", false)]
    [InlineData("https://224.0.0.1/push", false)]
    [InlineData("https://[::1]/push", false)]
    [InlineData("https://[fe80::1]/push", false)]
    [InlineData("https://[fc00::1]/push", false)]
    [InlineData("https://[fd00::1]/push", false)]
    [InlineData("https://[2001:db8::1]/push", false)]
    public async Task IsAllowedAsync_AcceptsOnlyPublicIpLiteralEndpoints(string endpoint, bool expected)
    {
        Assert.Equal(expected, await IsAllowedAsync(endpoint));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("/relative")]
    [InlineData("http://1.1.1.1/push")]
    [InlineData("https://user:pass@1.1.1.1/push")]
    [InlineData("https://localhost/push")]
    public async Task IsAllowedAsync_RejectsMalformedOrLocalHostEndpoints(string endpoint)
    {
        Assert.False(await IsAllowedAsync(endpoint));
    }

    [Theory]
    [InlineData("::ffff:8.8.8.8", true)]
    [InlineData("100.63.255.255", true)]
    [InlineData("100.128.0.1", true)]
    [InlineData("172.15.255.255", true)]
    [InlineData("172.32.0.1", true)]
    [InlineData("192.0.1.1", true)]
    [InlineData("192.0.3.1", true)]
    [InlineData("255.255.255.255", false)]
    [InlineData("::", false)]
    public void IsPublicAddress_CoversPublicBoundaryAndIpv4MappedBranches(string address, bool expected)
    {
        Assert.Equal(expected, IsPublicAddress(address));
    }

    private static async Task<bool> IsAllowedAsync(string endpoint)
        => await (Task<bool>)IsAllowedMethod.Invoke(null, [endpoint, CancellationToken.None])!;

    private static bool IsPublicAddress(string address)
        => (bool)IsPublicAddressMethod.Invoke(null, [IPAddress.Parse(address)])!;
}
