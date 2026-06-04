using Scope.Core.Domain.Exceptions;
using Scope.Core.Infrastructure.Data;
using Scope.Core.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using System.Reflection;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class MfaServiceTests
{
    private static async Task<(CoreDbContext db, MfaService svc, Guid userId)> SetupAsync()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new CoreDbContext(options);
        var user = new Domain.Entities.User
        {
            Id = Guid.NewGuid(),
            Username = "lou",
            Email = "lou@example.com",
            DisplayName = "Lou",
            PasswordHash = "ignored",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return (db, new MfaService(db), user.Id);
    }

    [Fact]
    public async Task StartEnrollmentAsync_CreatesSecretAndRecoveryCodes()
    {
        var (db, svc, userId) = await SetupAsync();

        var enrollment = await svc.StartEnrollmentAsync(userId);

        Assert.False(string.IsNullOrWhiteSpace(enrollment.Secret));
        Assert.StartsWith("otpauth://totp/", enrollment.OtpAuthUri);
        Assert.Equal(10, enrollment.RecoveryCodes.Count);
        var stored = await db.Users.FirstAsync();
        Assert.Equal(enrollment.Secret, stored.MfaSecret);
        Assert.False(stored.MfaEnabled);
        Assert.False(string.IsNullOrWhiteSpace(stored.MfaRecoveryCodesHash));
    }

    [Fact]
    public async Task ValidateAsync_AcceptsRecoveryCodeOnceOnly()
    {
        var (db, svc, userId) = await SetupAsync();
        var enrollment = await svc.StartEnrollmentAsync(userId);
        var user = await db.Users.FirstAsync();
        user.MfaEnabled = true;
        await db.SaveChangesAsync();
        var code = enrollment.RecoveryCodes[0];

        Assert.True(await svc.ValidateAsync(userId, code));
        Assert.False(await svc.ValidateAsync(userId, code));
    }

    [Fact]
    public async Task StartEnrollmentAsync_RejectsWhenMfaAlreadyEnabled()
    {
        var (db, svc, userId) = await SetupAsync();
        var user = await db.Users.FirstAsync();
        user.MfaEnabled = true;
        user.MfaSecret = "JBSWY3DPEHPK3PXP";
        user.MfaRecoveryCodesHash = "existing";
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictException>(() => svc.StartEnrollmentAsync(userId));

        Assert.True(user.MfaEnabled);
        Assert.Equal("JBSWY3DPEHPK3PXP", user.MfaSecret);
        Assert.Equal("existing", user.MfaRecoveryCodesHash);
    }

    [Fact]
    public async Task ConfirmAsync_RejectsInvalidCode()
    {
        var (_, svc, userId) = await SetupAsync();
        await svc.StartEnrollmentAsync(userId);

        await Assert.ThrowsAsync<UnauthorizedException>(() => svc.ConfirmAsync(userId, "000000"));
    }

    [Fact]
    public async Task ConfirmAndDisableAsync_AcceptValidTotpAndRecoveryCode()
    {
        await using var db = new CoreDbContext(new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        var user = new Domain.Entities.User
        {
            Id = Guid.NewGuid(),
            Username = "mfa-user",
            Email = "mfa@example.com",
            DisplayName = "Mfa User",
            PasswordHash = "ignored",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var notifications = new CapturingNotificationService();
        var svc = new MfaService(db, notifications);
        var enrollment = await svc.StartEnrollmentAsync(user.Id);

        await svc.ConfirmAsync(user.Id, CurrentTotp(enrollment.Secret));

        Assert.True(user.MfaEnabled);
        Assert.Contains(notifications.Created, x => x.Type == "security.mfa.enabled");

        await Assert.ThrowsAsync<UnauthorizedException>(() => svc.DisableAsync(user.Id, "000000"));
        await svc.DisableAsync(user.Id, enrollment.RecoveryCodes[0]);

        Assert.False(user.MfaEnabled);
        Assert.Null(user.MfaSecret);
        Assert.Null(user.MfaRecoveryCodesHash);
        Assert.Contains(notifications.Created, x => x.Type == "security.mfa.disabled");

        await svc.DisableAsync(user.Id, "anything");
    }

    [Fact]
    public async Task ValidateAsync_ReturnsFalseForMissingUserDisabledMfaAndBlankCode()
    {
        var (db, svc, userId) = await SetupAsync();

        Assert.False(await svc.ValidateAsync(userId, " "));
        Assert.False(await svc.ValidateAsync(Guid.NewGuid(), "123456"));
        Assert.False(await svc.ValidateAsync(userId, "123456"));
        await Assert.ThrowsAsync<NotFoundException>(() => svc.StartEnrollmentAsync(Guid.NewGuid()));
        await db.DisposeAsync();
    }

    private static string CurrentTotp(string secret)
    {
        var decode = typeof(MfaService).GetMethod("Base32Decode", BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new MissingMethodException(nameof(MfaService), "Base32Decode");
        var generate = typeof(MfaService).GetMethod("GenerateCode", BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new MissingMethodException(nameof(MfaService), "GenerateCode");
        var secretBytes = (byte[])decode.Invoke(null, [secret])!;
        var counter = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        var code = (int)generate.Invoke(null, [secretBytes, counter])!;
        return code.ToString("D6");
    }
}
