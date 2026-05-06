using System.Collections.Concurrent;
using System.Net.Http;
using System.Text.Json;
using Scope.Core.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Scope.Core.Infrastructure.Services;

public sealed class TripMembershipValidator(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<TripMembershipValidator> logger) : ITripMembershipValidator
{
    private const string HttpClientName = "content";
    private const string DefaultContentServiceUrl = "http://content:8000/api/content";

    private static readonly TimeSpan CacheLifetime = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan ContentTimeout = TimeSpan.FromSeconds(3);
    private static readonly ConcurrentDictionary<string, CacheEntry> Cache = new();

    public async Task<bool> IsMemberAsync(Guid tripId, Guid userId, string bearerToken, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"{tripId}:{userId}";
        if (Cache.TryGetValue(cacheKey, out var entry) && entry.Expires > DateTimeOffset.UtcNow)
        {
            return entry.IsMember;
        }

        if (string.IsNullOrWhiteSpace(bearerToken))
        {
            return false;
        }

        var baseUrl = configuration["CONTENT_SERVICE_URL"] ?? DefaultContentServiceUrl;

        try
        {
            using var client = httpClientFactory.CreateClient(HttpClientName);
            client.Timeout = ContentTimeout;
            var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl.TrimEnd('/')}/trips/{tripId}/members");
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {bearerToken}");
            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                CacheResult(cacheKey, isMember: false);
                return false;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var members = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var data) ? data : root;
            if (members.ValueKind != JsonValueKind.Array)
            {
                CacheResult(cacheKey, isMember: false);
                return false;
            }

            var idString = userId.ToString();
            foreach (var member in members.EnumerateArray())
            {
                if (member.TryGetProperty("user_id", out var uid) && string.Equals(uid.GetString(), idString, StringComparison.OrdinalIgnoreCase))
                {
                    CacheResult(cacheKey, isMember: true);
                    return true;
                }
            }
            CacheResult(cacheKey, isMember: false);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Membership lookup failed for trip {TripId}", tripId);
            return false;
        }
    }

    private static void CacheResult(string key, bool isMember)
        => Cache[key] = new CacheEntry(isMember, DateTimeOffset.UtcNow.Add(CacheLifetime));

    private readonly record struct CacheEntry(bool IsMember, DateTimeOffset Expires);
}
