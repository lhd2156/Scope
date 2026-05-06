using System.Security.Cryptography;
using System.Text;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Scope.Core.Infrastructure.Services;

public sealed class EmailVerificationService(
    CoreDbContext dbContext,
    IKafkaProducerService kafkaProducerService,
    ILogger<EmailVerificationService>? logger = null) : IEmailVerificationService
{
    private static readonly EventId AuditEvent = new(9003, "scope.security.audit");
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromHours(24);
    // Stops users from accidentally hammering the "resend email" button and
    // being flagged as spam by the provider.
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromMinutes(5);

    public async Task SendAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            ?? throw new NotFoundException("User not found");
        if (user.EmailVerifiedAt is not null)
        {
            Audit("email_verify_send", "skipped", user.Id.ToString(), "already_verified");
            return;
        }

        var now = DateTimeOffset.UtcNow;
        if (user.EmailVerificationSentAt is { } lastSent && lastSent > now - ResendCooldown)
        {
            Audit("email_verify_send", "throttled", user.Id.ToString());
            return;
        }

        var plaintext = NewToken();
        user.EmailVerificationTokenHash = Sha256Hex(plaintext);
        user.EmailVerificationSentAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        await kafkaProducerService.PublishAsync(
            "user.email_verification_requested",
            new
            {
                userId = user.Id,
                email = user.Email,
                displayName = user.DisplayName,
                token = plaintext,
                expiresAt = now.Add(TokenLifetime),
            },
            cancellationToken);

        Audit("email_verify_send", "success", user.Id.ToString());
    }

    public async Task<bool> ConfirmAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            Audit("email_verify_confirm", "failure", null, "empty_token");
            throw new ValidationException("Invalid verification token", [("token", "Token is required.")]);
        }

        var hash = Sha256Hex(token);
        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.EmailVerificationTokenHash == hash, cancellationToken);
        if (user is null)
        {
            Audit("email_verify_confirm", "failure", null, "unknown_token");
            throw new UnauthorizedException("Invalid verification token");
        }

        var now = DateTimeOffset.UtcNow;
        if (user.EmailVerificationSentAt is null || user.EmailVerificationSentAt.Value.Add(TokenLifetime) < now)
        {
            user.EmailVerificationTokenHash = null;
            await dbContext.SaveChangesAsync(cancellationToken);
            Audit("email_verify_confirm", "failure", user.Id.ToString(), "expired_token");
            throw new UnauthorizedException("Verification token expired");
        }

        if (user.EmailVerifiedAt is not null)
        {
            Audit("email_verify_confirm", "skipped", user.Id.ToString(), "already_verified");
            return false;
        }

        user.EmailVerifiedAt = now;
        user.EmailVerificationTokenHash = null;
        await dbContext.SaveChangesAsync(cancellationToken);
        Audit("email_verify_confirm", "success", user.Id.ToString());
        return true;
    }

    private static string NewToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    internal static string Sha256Hex(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes);
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
