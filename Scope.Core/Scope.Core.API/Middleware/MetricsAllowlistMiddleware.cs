using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Scope.Core.API.Middleware;

public sealed class MetricsAllowlistMiddleware(
    RequestDelegate next,
    IConfiguration configuration,
    ILogger<MetricsAllowlistMiddleware> logger)
{
    private static readonly string[] DefaultRanges =
    {
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "127.0.0.0/8",
        "::1/128",
    };

    private readonly (IPAddress Address, int Prefix)[] allowlist = ParseRanges(
        (configuration["METRICS_ALLOWED_CIDRS"] ?? string.Join(';', DefaultRanges))
            .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));

    public async Task InvokeAsync(HttpContext context)
    {
        var remote = context.Connection.RemoteIpAddress;
        if (remote is null && configuration.GetValue<bool>("METRICS_ALLOW_UNKNOWN_REMOTE"))
        {
            await next(context);
            return;
        }

        if (remote is null || !IsAllowed(remote))
        {
            logger.LogWarning("Blocked /metrics request from {RemoteIp}", remote?.ToString() ?? "unknown");
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        await next(context);
    }

    private bool IsAllowed(IPAddress address)
    {
        var canonical = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
        foreach (var entry in allowlist)
        {
            if (InNetwork(canonical, entry.Address, entry.Prefix))
            {
                return true;
            }
        }
        return false;
    }

    private static bool InNetwork(IPAddress address, IPAddress network, int prefix)
    {
        if (address.AddressFamily != network.AddressFamily) return false;
        var addrBytes = address.GetAddressBytes();
        var netBytes = network.GetAddressBytes();
        var bits = prefix;
        for (var i = 0; i < netBytes.Length && bits > 0; i++)
        {
            var mask = bits >= 8 ? 0xFF : (byte)(0xFF << (8 - bits));
            if ((addrBytes[i] & mask) != (netBytes[i] & mask)) return false;
            bits -= 8;
        }
        return true;
    }

    private static (IPAddress Address, int Prefix)[] ParseRanges(string[] ranges)
    {
        var list = new List<(IPAddress, int)>();
        foreach (var raw in ranges)
        {
            var parts = raw.Split('/', 2);
            if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var addr) || !int.TryParse(parts[1], out var prefix))
            {
                continue;
            }
            list.Add((addr, prefix));
        }
        return list.ToArray();
    }
}
