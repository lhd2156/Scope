using Scope.Core.Domain.Exceptions;
using Scope.Core.Infrastructure.Data;
using Scope.Core.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    public async Task ConfirmAsync_RejectsWhenEnrollmentHasNotStarted()
    {
        var (_, svc, userId) = await SetupAsync();

        await Assert.ThrowsAsync<ValidationException>(() => svc.ConfirmAsync(userId, "123456"));
    }

    [Fact]
    public async Task ConfirmAsync_AcceptsValidTotpWithoutNotificationService()
    {
        var (db, svc, userId) = await SetupAsync();
        var enrollment = await svc.StartEnrollmentAsync(userId);

        await svc.ConfirmAsync(userId, CurrentTotp(enrollment.Secret));

        Assert.True((await db.Users.SingleAsync()).MfaEnabled);
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

    [Fact]
    public async Task ValidateAsync_ReturnsFalseWhenRecoveryCodeStoreIsEmpty()
    {
        var (db, svc, userId) = await SetupAsync();
        var user = await db.Users.SingleAsync();
        user.MfaEnabled = true;
        user.MfaSecret = "JBSWY3DPEHPK3PXP";
        user.MfaRecoveryCodesHash = null;
        await db.SaveChangesAsync();

        Assert.False(await svc.ValidateAsync(userId, "RECOVERY000"));
    }

    [Fact]
    public async Task MissingUsersAndAuditLogger_CoverSecurityAuditBranches()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var db = new CoreDbContext(options);
        var user = new Domain.Entities.User
        {
            Id = Guid.NewGuid(),
            Username = "logged-mfa",
            Email = "logged-mfa@example.com",
            DisplayName = "Logged MFA",
            PasswordHash = "ignored",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        var logger = new CapturingMfaLogger();
        var svc = new MfaService(db, logger: logger);

        await Assert.ThrowsAsync<NotFoundException>(() => svc.ConfirmAsync(Guid.NewGuid(), "123456"));
        await Assert.ThrowsAsync<NotFoundException>(() => svc.DisableAsync(Guid.NewGuid(), "123456"));

        await svc.StartEnrollmentAsync(user.Id);
        user.MfaEnabled = true;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<ConflictException>(() => svc.StartEnrollmentAsync(user.Id));

        Assert.Contains(logger.Entries, x => x.Level == LogLevel.Information && x.Message.Contains("outcome=success"));
        Assert.Contains(logger.Entries, x => x.Level == LogLevel.Warning && x.Message.Contains("reason=already_enabled"));
    }

    [Fact]
    public void Base32Encode_HandlesPartialTrailingByteGroups()
    {
        var encode = typeof(MfaService).GetMethod("Base32Encode", BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new MissingMethodException(nameof(MfaService), "Base32Encode");

        var encoded = (string)encode.Invoke(null, [new byte[] { 0xff }])!;

        Assert.Equal("74", encoded);
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

    private sealed class CapturingMfaLogger : ILogger<MfaService>
    {
        public List<(LogLevel Level, string Message)> Entries { get; } = [];

        public IDisposable BeginScope<TState>(TState state) where TState : notnull => NoopScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception)));

        private sealed class NoopScope : IDisposable
        {
            public static readonly NoopScope Instance = new();

            public void Dispose()
            {
            }
        }
    }
}
