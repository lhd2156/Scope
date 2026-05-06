using Scope.Core.Domain.Exceptions;
using Scope.Core.Infrastructure.Data;
using Scope.Core.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
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
    public async Task ConfirmAsync_RejectsInvalidCode()
    {
        var (_, svc, userId) = await SetupAsync();
        await svc.StartEnrollmentAsync(userId);

        await Assert.ThrowsAsync<UnauthorizedException>(() => svc.ConfirmAsync(userId, "000000"));
    }
}
