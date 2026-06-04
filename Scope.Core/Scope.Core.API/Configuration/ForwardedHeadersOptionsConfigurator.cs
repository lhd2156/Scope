using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using AspNetCoreIpNetwork = Microsoft.AspNetCore.HttpOverrides.IPNetwork;

namespace Scope.Core.API.Configuration;

public static class ForwardedHeadersOptionsConfigurator
{
    public const string KnownProxiesKey = "CORE_FORWARDED_HEADERS_KNOWN_PROXIES";
    public const string KnownNetworksKey = "CORE_FORWARDED_HEADERS_KNOWN_NETWORKS";
    public const string ForwardLimitKey = "CORE_FORWARDED_HEADERS_FORWARD_LIMIT";

    public static void Configure(ForwardedHeadersOptions options, IConfiguration configuration)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = ParsePositiveInt(configuration[ForwardLimitKey], ForwardLimitKey) ?? 1;

        var proxyValues = SplitList(configuration[KnownProxiesKey]);
        var networkValues = SplitList(configuration[KnownNetworksKey]);
        if (proxyValues.Count == 0 && networkValues.Count == 0)
        {
            // Preserve ASP.NET Core's loopback-only trust defaults unless ops
            // has explicitly supplied the reverse proxy allowlist.
            return;
        }

        options.KnownProxies.Clear();
        options.KnownNetworks.Clear();

        foreach (var proxyValue in proxyValues)
        {
            options.KnownProxies.Add(ParseIpAddress(proxyValue, KnownProxiesKey));
        }

        foreach (var networkValue in networkValues)
        {
            options.KnownNetworks.Add(ParseNetwork(networkValue, KnownNetworksKey));
        }
    }

    private static IReadOnlyList<string> SplitList(string? rawValue)
    {
        return (rawValue ?? string.Empty)
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();
    }

    private static IPAddress ParseIpAddress(string rawValue, string key)
    {
        if (IPAddress.TryParse(rawValue, out var address))
        {
            return address;
        }

        throw new InvalidOperationException($"{key} contains an invalid IP address: {rawValue}");
    }

    private static AspNetCoreIpNetwork ParseNetwork(string rawValue, string key)
    {
        var parts = rawValue.Split('/', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 ||
            !IPAddress.TryParse(parts[0], out var address) ||
            !int.TryParse(parts[1], out var prefixLength))
        {
            throw new InvalidOperationException($"{key} contains an invalid CIDR range: {rawValue}");
        }

        var maxPrefixLength = address.AddressFamily == AddressFamily.InterNetwork ? 32 : 128;
        if (prefixLength < 0 || prefixLength > maxPrefixLength)
        {
            throw new InvalidOperationException($"{key} contains an invalid CIDR prefix length: {rawValue}");
        }

        return new AspNetCoreIpNetwork(address, prefixLength);
    }

    private static int? ParsePositiveInt(string? rawValue, string key)
    {
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        if (int.TryParse(rawValue, out var value) && value > 0)
        {
            return value;
        }

        throw new InvalidOperationException($"{key} must be a positive integer.");
    }
}
