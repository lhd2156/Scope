using System.Security.Cryptography;
using System.Text;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Scope.Core.Infrastructure.Services;

// RFC 6238 TOTP-SHA1 implemented without an external dependency (smaller
// attack surface than pulling a third-party MFA lib). Parameters:
//   * 6-digit code
//   * 30-second step
//   * +/- 1 step drift window to tolerate modest clock skew
//
// Secrets are stored base-32 encoded, never base64 — TOTP RFCs standardise on
// base-32 for the shared secret so authenticator apps can parse otpauth:// URIs.
// Recovery codes are random 10-char strings, stored as SHA-256 hashes; the
// plaintext list is only returned once during StartEnrollmentAsync.
public sealed class MfaService(
    CoreDbContext dbContext,
    ILogger<MfaService>? logger = null) : IMfaService
{
    private static readonly EventId AuditEvent = new(9004, "scope.security.audit");
    private const int TotpDigits = 6;
    private const int StepSeconds = 30;
    private const int DriftWindow = 1;
    private const int SecretLengthBytes = 20;
    private const int RecoveryCodeCount = 10;
    private const string Issuer = "Scope";

    public async Task<MfaEnrollment> StartEnrollmentAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User not found");

        var secretBytes = RandomNumberGenerator.GetBytes(SecretLengthBytes);
        var secret = Base32Encode(secretBytes);
        var codes = Enumerable.Range(0, RecoveryCodeCount).Select(_ => NewRecoveryCode()).ToArray();
        var hashed = string.Join(',', codes.Select(Sha256Hex));

        user.MfaSecret = secret;
        user.MfaRecoveryCodesHash = hashed;
        user.MfaEnabled = false;
        await dbContext.SaveChangesAsync(cancellationToken);

        var otpauth = BuildOtpAuthUri(user.Email, secret);
        Audit("mfa_enroll_start", "success", user.Id.ToString());
        return new MfaEnrollment(secret, otpauth, codes);
    }

    public async Task ConfirmAsync(Guid userId, string code, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User not found");
        if (string.IsNullOrWhiteSpace(user.MfaSecret))
        {
            Audit("mfa_enroll_confirm", "failure", user.Id.ToString(), "no_pending_enrollment");
            throw new ValidationException("MFA enrollment has not been started", [("mfa", "Start MFA enrollment first.")]);
        }
        if (!VerifyTotp(user.MfaSecret, code))
        {
            Audit("mfa_enroll_confirm", "failure", user.Id.ToString(), "bad_code");
            throw new UnauthorizedException("Invalid MFA code");
        }
        user.MfaEnabled = true;
        await dbContext.SaveChangesAsync(cancellationToken);
        Audit("mfa_enroll_confirm", "success", user.Id.ToString());
    }

    public async Task DisableAsync(Guid userId, string code, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User not found");
        if (!user.MfaEnabled || string.IsNullOrWhiteSpace(user.MfaSecret))
        {
            Audit("mfa_disable", "skipped", user.Id.ToString(), "not_enabled");
            return;
        }
        if (!await ValidateAsync(user.Id, code, cancellationToken))
        {
            Audit("mfa_disable", "failure", user.Id.ToString(), "bad_code");
            throw new UnauthorizedException("Invalid MFA code");
        }
        user.MfaEnabled = false;
        user.MfaSecret = null;
        user.MfaRecoveryCodesHash = null;
        await dbContext.SaveChangesAsync(cancellationToken);
        Audit("mfa_disable", "success", user.Id.ToString());
    }

    public async Task<bool> ValidateAsync(Guid userId, string code, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null || !user.MfaEnabled || string.IsNullOrWhiteSpace(user.MfaSecret)) return false;

        // Recovery codes are opaque strings; try them first (they consume).
        if (code.Length >= 10 && await TryConsumeRecoveryCodeAsync(user, code, cancellationToken)) return true;
        return VerifyTotp(user.MfaSecret, code);
    }

    private async Task<bool> TryConsumeRecoveryCodeAsync(Domain.Entities.User user, string code, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(user.MfaRecoveryCodesHash)) return false;
        var target = Sha256Hex(code.Trim().ToUpperInvariant());
        var list = user.MfaRecoveryCodesHash.Split(',', StringSplitOptions.RemoveEmptyEntries);
        var remaining = list.Where(h => !string.Equals(h, target, StringComparison.Ordinal)).ToArray();
        if (remaining.Length == list.Length) return false;
        user.MfaRecoveryCodesHash = string.Join(',', remaining);
        await dbContext.SaveChangesAsync(cancellationToken);
        Audit("mfa_recovery_code_consumed", "success", user.Id.ToString());
        return true;
    }

    private static bool VerifyTotp(string base32Secret, string code)
    {
        if (!int.TryParse(code.Trim(), out var provided)) return false;
        var secret = Base32Decode(base32Secret);
        var counter = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / StepSeconds;
        for (var drift = -DriftWindow; drift <= DriftWindow; drift++)
        {
            if (GenerateCode(secret, counter + drift) == provided) return true;
        }
        return false;
    }

    private static int GenerateCode(byte[] secret, long counter)
    {
        Span<byte> counterBytes = stackalloc byte[8];
        for (var i = 7; i >= 0; i--)
        {
            counterBytes[i] = (byte)(counter & 0xff);
            counter >>= 8;
        }
        using var hmac = new HMACSHA1(secret);
        var hash = hmac.ComputeHash(counterBytes.ToArray());
        var offset = hash[^1] & 0x0f;
        var binary = ((hash[offset] & 0x7f) << 24)
                   | ((hash[offset + 1] & 0xff) << 16)
                   | ((hash[offset + 2] & 0xff) << 8)
                   | (hash[offset + 3] & 0xff);
        return binary % (int)Math.Pow(10, TotpDigits);
    }

    private static string BuildOtpAuthUri(string email, string base32Secret)
    {
        var label = Uri.EscapeDataString($"{Issuer}:{email}");
        var issuer = Uri.EscapeDataString(Issuer);
        return $"otpauth://totp/{label}?secret={base32Secret}&issuer={issuer}&algorithm=SHA1&digits={TotpDigits}&period={StepSeconds}";
    }

    private static string NewRecoveryCode()
    {
        // 5 + 5 uppercase base32 chars, dash-separated for readability.
        const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        Span<byte> rnd = stackalloc byte[10];
        RandomNumberGenerator.Fill(rnd);
        var sb = new StringBuilder(11);
        for (var i = 0; i < rnd.Length; i++)
        {
            if (i == 5) sb.Append('-');
            sb.Append(Alphabet[rnd[i] % Alphabet.Length]);
        }
        return sb.ToString();
    }

    private static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
    }

    private static string Base32Encode(byte[] data)
    {
        const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var sb = new StringBuilder((data.Length * 8 + 4) / 5);
        int buffer = 0, bitsLeft = 0;
        foreach (var b in data)
        {
            buffer = (buffer << 8) | b;
            bitsLeft += 8;
            while (bitsLeft >= 5)
            {
                sb.Append(Alphabet[(buffer >> (bitsLeft - 5)) & 0x1f]);
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0)
        {
            sb.Append(Alphabet[(buffer << (5 - bitsLeft)) & 0x1f]);
        }
        return sb.ToString();
    }

    private static byte[] Base32Decode(string input)
    {
        const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var trimmed = input.TrimEnd('=').ToUpperInvariant();
        var output = new List<byte>(trimmed.Length * 5 / 8);
        int buffer = 0, bitsLeft = 0;
        foreach (var c in trimmed)
        {
            var idx = Alphabet.IndexOf(c);
            if (idx < 0) continue;
            buffer = (buffer << 5) | idx;
            bitsLeft += 5;
            if (bitsLeft >= 8)
            {
                output.Add((byte)((buffer >> (bitsLeft - 8)) & 0xff));
                bitsLeft -= 8;
            }
        }
        return output.ToArray();
    }

    private void Audit(string eventName, string outcome, string? userId, string? reason = null)
    {
        logger?.Log(
            outcome == "success" ? LogLevel.Information : LogLevel.Warning,
            AuditEvent,
            "security_audit event={Event} outcome={Outcome} userId={UserId} reason={Reason}",
            eventName,
            outcome,
            userId ?? "anonymous",
            reason ?? "-");
    }
}
