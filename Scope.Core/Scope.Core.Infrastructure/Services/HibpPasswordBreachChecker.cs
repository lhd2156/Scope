using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using Scope.Core.Domain.Interfaces;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Scope.Core.Infrastructure.Services;

// Have-I-Been-Pwned k-anonymity breach check.
//
// Protocol (RFC draft / https://haveibeenpwned.com/API/v3#PwnedPasswords):
//  1. Compute SHA-1 of the password.
//  2. Send the FIRST 5 hex chars to `https://api.pwnedpasswords.com/range/<prefix>`.
//  3. Server returns every SHA-1 suffix whose prefix matches, along with the
//     number of times each has been seen in known breaches.
//  4. Locally, look for our suffix in the response.
//
// Properties:
//  * The full password never leaves the process.
//  * Only the first 5 of 40 SHA-1 hex chars are transmitted, so ~5,000 other
//    hashes share each prefix – HIBP cannot identify which specific password
//    was checked.
//  * We treat any count >= threshold as "breached".
//  * If HIBP is unreachable, misconfigured, or slow we FAIL OPEN so users can
//    still register; the local `PasswordPolicy` already rejects the most
//    common weak passwords, so this remains a secondary control.
public sealed class HibpPasswordPolicyOptions
{
    public const string SectionName = "Hibp";

    public bool Enabled { get; set; }
    public string BaseUrl { get; set; } = "https://api.pwnedpasswords.com";
    public int BreachThreshold { get; set; } = 1;
    public int TimeoutSeconds { get; set; } = 2;
    public int CacheSeconds { get; set; } = 3600;
}

public sealed class HibpPasswordBreachChecker(
    IHttpClientFactory httpClientFactory,
    IMemoryCache cache,
    IOptions<HibpPasswordPolicyOptions> options,
    ILogger<HibpPasswordBreachChecker>? logger = null) : IPasswordBreachChecker
{
    private readonly HibpPasswordPolicyOptions settings = options.Value;

    public async Task<bool> IsBreachedAsync(string password, CancellationToken cancellationToken = default)
    {
        if (!settings.Enabled || string.IsNullOrEmpty(password))
        {
            return false;
        }

        var hash = Sha1Upper(password);
        var prefix = hash[..5];
        var suffix = hash[5..];

        try
        {
            var payload = await cache.GetOrCreateAsync(Cachekey(prefix), async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(settings.CacheSeconds);
                var client = httpClientFactory.CreateClient("hibp");
                client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds);
                client.DefaultRequestHeaders.Add("Add-Padding", "true");
                var response = await client.GetAsync($"{settings.BaseUrl.TrimEnd('/')}/range/{prefix}", cancellationToken);
                response.EnsureSuccessStatusCode();
                return await response.Content.ReadAsStringAsync(cancellationToken);
            });

            if (string.IsNullOrEmpty(payload)) return false;

            foreach (var line in payload.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var parts = line.Split(':', 2);
                if (parts.Length != 2) continue;
                if (!parts[0].Equals(suffix, StringComparison.OrdinalIgnoreCase)) continue;
                if (int.TryParse(parts[1], out var count) && count >= settings.BreachThreshold)
                {
                    return true;
                }
                return false;
            }
            return false;
        }
        catch (Exception ex)
        {
            // Fail-open: record and let the request proceed. Local password
            // policy is still enforced upstream.
            logger?.LogWarning(ex, "HIBP breach check failed; allowing request");
            return false;
        }
    }

    private static string Cachekey(string prefix) => $"hibp:{prefix}";

    private static string Sha1Upper(string input)
    {
        var bytes = SHA1.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }
}

// No-op implementation used when HIBP is disabled or for unit tests that
// shouldn't make outbound HTTP calls.
public sealed class NullPasswordBreachChecker : IPasswordBreachChecker
{
    public Task<bool> IsBreachedAsync(string password, CancellationToken cancellationToken = default) => Task.FromResult(false);
}
