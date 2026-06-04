using System.Net;
using System.Net.Sockets;

namespace Scope.Core.API.Infrastructure;

internal static class PushEndpointValidator
{
    public const string InvalidEndpointMessage = "Push subscription endpoint must be an HTTPS URL with a public host.";

    public static async Task<bool> IsAllowedAsync(string endpoint, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(uri.Host) ||
            !string.IsNullOrEmpty(uri.UserInfo))
        {
            return false;
        }

        if (IPAddress.TryParse(uri.Host, out var literalAddress))
        {
            return IsPublicAddress(literalAddress);
        }

        try
        {
            var addresses = await Dns.GetHostAddressesAsync(uri.IdnHost, cancellationToken);
            return addresses.Length > 0 && addresses.All(IsPublicAddress);
        }
        catch (SocketException)
        {
            return false;
        }
    }

    private static bool IsPublicAddress(IPAddress address)
    {
        var candidate = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
        if (IPAddress.IsLoopback(candidate) ||
            candidate.Equals(IPAddress.Any) ||
            candidate.Equals(IPAddress.Broadcast) ||
            candidate.Equals(IPAddress.IPv6Any) ||
            candidate.Equals(IPAddress.IPv6Loopback) ||
            candidate.Equals(IPAddress.IPv6None))
        {
            return false;
        }

        return candidate.AddressFamily switch
        {
            AddressFamily.InterNetwork => IsPublicIpv4(candidate.GetAddressBytes()),
            AddressFamily.InterNetworkV6 => IsPublicIpv6(candidate),
            _ => false,
        };
    }

    private static bool IsPublicIpv4(byte[] bytes)
    {
        if (bytes[0] is 0 or 10 or 127 || bytes[0] >= 224)
        {
            return false;
        }

        if (bytes[0] == 100 && bytes[1] is >= 64 and <= 127) return false;
        if (bytes[0] == 169 && bytes[1] == 254) return false;
        if (bytes[0] == 172 && bytes[1] is >= 16 and <= 31) return false;
        if (bytes[0] == 192 && bytes[1] == 168) return false;
        if (bytes[0] == 192 && bytes[1] == 0 && bytes[2] is 0 or 2) return false;
        if (bytes[0] == 198 && bytes[1] is 18 or 19) return false;
        if (bytes[0] == 198 && bytes[1] == 51 && bytes[2] == 100) return false;
        if (bytes[0] == 203 && bytes[1] == 0 && bytes[2] == 113) return false;
        return true;
    }

    private static bool IsPublicIpv6(IPAddress address)
    {
        if (address.IsIPv6LinkLocal || address.IsIPv6Multicast || address.IsIPv6SiteLocal)
        {
            return false;
        }

        var bytes = address.GetAddressBytes();
        if ((bytes[0] & 0xfe) == 0xfc)
        {
            return false;
        }

        return !(bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] == 0x0d && bytes[3] == 0xb8);
    }
}
