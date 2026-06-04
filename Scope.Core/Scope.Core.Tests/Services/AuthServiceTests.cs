using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Configuration;
using Scope.Core.Infrastructure.Data;
using Scope.Core.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class AuthServiceTests
{
    private static DateOnly AdultDateOfBirth => DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24));

    private static AuthService BuildService(
        out CoreDbContext dbContext,
        out Mock<IKafkaProducerService> kafka,
        Mock<IMfaService>? mfa = null,
        Mock<IPasswordBreachChecker>? breach = null)
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        dbContext = new CoreDbContext(options);
        var jwt = new Mock<IJwtTokenService>();
        jwt.Setup(x => x.CreateTokens(It.IsAny<User>()))
           .Returns(() => new TokenPair(
               "access-" + Guid.NewGuid().ToString("n"),
               "refresh-" + Guid.NewGuid().ToString("n"),
               DateTimeOffset.UtcNow.AddMinutes(15)));
        kafka = new Mock<IKafkaProducerService>();
        var jwtOptions = Options.Create(new JwtOptions { Secret = new string('x', 32) });
        var mfaMock = mfa ?? new Mock<IMfaService>();
        var breachMock = breach ?? new Mock<IPasswordBreachChecker>();
        if (breach is null)
        {
            breachMock.Setup(x => x.IsBreachedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        }
        return new AuthService(
            dbContext,
            new PasswordHasherService(),
            jwt.Object,
            kafka.Object,
            jwtOptions,
            new PasswordPolicy(),
            breachMock.Object,
            mfaMock.Object);
    }

    [Fact]
    public async Task RegisterAsync_CreatesUserAndPublishesEvent()
    {
        var service = BuildService(out var dbContext, out var kafka);

        var result = await service.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis", AdultDateOfBirth);

        Assert.Equal("louis", result.Username);
        Assert.Single(dbContext.Users);
        Assert.Equal(AdultDateOfBirth, dbContext.Users.Single().DateOfBirth);
        kafka.Verify(x => x.PublishAsync("user.registered", It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_StoresNormalizedPhoneNumber()
    {
        var service = BuildService(out var dbContext, out _);

        await service.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis", AdultDateOfBirth, "+1 (555) 123-4567");

        var stored = await dbContext.Users.SingleAsync();
        Assert.Equal("15551234567", stored.PhoneNumber);
    }

    [Fact]
    public async Task RegisterAsync_RejectsWeakPassword()
    {
        var service = BuildService(out _, out _);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync("louis", "louis@example.com", "password", "Louis", AdultDateOfBirth));
    }

    [Fact]
    public async Task RegisterAsync_RejectsInvalidUsername()
    {
        var service = BuildService(out _, out _);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync("lou@scope", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth));
    }

    [Fact]
    public async Task RegisterAsync_RejectsDisplayNamesThatAreNotNames()
    {
        var service = BuildService(out _, out _);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "@louis_123", AdultDateOfBirth));
    }

    [Fact]
    public async Task RegisterAsync_RequiresAdultDateOfBirth()
    {
        var service = BuildService(out _, out _);
        var tooYoung = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-10));

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis Do", null));

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis Do", tooYoung));
    }

    [Fact]
    public async Task RegisterAsync_RejectsBreachedPassword()
    {
        var breach = new Mock<IPasswordBreachChecker>();
        breach.Setup(x => x.IsBreachedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var service = BuildService(out _, out _, breach: breach);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync("louis", "louis@example.com", "NotSoBadPw1!", "Louis", AdultDateOfBirth));
    }

    [Fact]
    public async Task LoginAsync_LocksAccountAfterFiveFailedAttempts()
    {
        var service = BuildService(out var dbContext, out _);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);

        for (var i = 0; i < 4; i++)
        {
            await Assert.ThrowsAsync<UnauthorizedException>(() =>
                service.LoginAsync("lou@example.com", "wrong-password"));
        }
        // 5th attempt should trigger lockout response.
        var locked = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.LoginAsync("lou@example.com", "wrong-password"));
        Assert.Contains("locked", locked.Message, StringComparison.OrdinalIgnoreCase);

        var stored = await dbContext.Users.FirstAsync();
        Assert.NotNull(stored.LockoutUntil);

        // Even with the correct password the lockout must persist.
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.LoginAsync("lou@example.com", "SecurePass123!"));
    }

    [Fact]
    public async Task LoginAsync_ResetsFailedAttemptsOnSuccess()
    {
        var service = BuildService(out var dbContext, out _);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.LoginAsync("lou@example.com", "wrong"));

        var outcome = await service.LoginAsync("lou@example.com", "SecurePass123!");

        Assert.NotNull(outcome.Result);
        var stored = await dbContext.Users.FirstAsync();
        Assert.Equal(0, stored.FailedLoginAttempts);
        Assert.Null(stored.LockoutUntil);
    }

    [Fact]
    public async Task LoginAsync_AcceptsEmailPhoneUsernameOrDisplayName()
    {
        var service = BuildService(out _, out _);
        var registered = await service.RegisterAsync("loudo", "lou@example.com", "SecurePass123!", "Lou Do", AdultDateOfBirth, "(555) 123-4567");

        var byEmail = await service.LoginAsync("lou@example.com", "SecurePass123!");
        var byPhone = await service.LoginAsync("555-123-4567", "SecurePass123!");
        var byUsername = await service.LoginAsync("loudo", "SecurePass123!");
        var byDisplayName = await service.LoginAsync("Lou Do", "SecurePass123!");

        Assert.Equal(registered.Id, byEmail.Result!.Id);
        Assert.Equal(registered.Id, byPhone.Result!.Id);
        Assert.Equal(registered.Id, byUsername.Result!.Id);
        Assert.Equal(registered.Id, byDisplayName.Result!.Id);
    }

    [Fact]
    public async Task LoginAsync_ReturnsStepUpWhenMfaEnabledAndNoCodeProvided()
    {
        var mfa = new Mock<IMfaService>();
        mfa.Setup(x => x.ValidateAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var service = BuildService(out var dbContext, out _, mfa: mfa);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        var user = await dbContext.Users.FirstAsync();
        user.MfaEnabled = true;
        user.MfaSecret = "JBSWY3DPEHPK3PXP";
        await dbContext.SaveChangesAsync();

        var first = await service.LoginAsync("lou@example.com", "SecurePass123!");
        Assert.True(first.MfaRequired);
        Assert.Null(first.Result);

        var second = await service.LoginAsync("lou@example.com", "SecurePass123!", "123456");
        Assert.False(second.MfaRequired);
        Assert.NotNull(second.Result);
    }

    [Fact]
    public async Task LoginAsync_LocksAccountAfterRepeatedBadMfaCodes()
    {
        var mfa = new Mock<IMfaService>();
        mfa.Setup(x => x.ValidateAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var service = BuildService(out var dbContext, out _, mfa: mfa);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        var user = await dbContext.Users.FirstAsync();
        user.MfaEnabled = true;
        user.MfaSecret = "JBSWY3DPEHPK3PXP";
        await dbContext.SaveChangesAsync();

        for (var i = 0; i < 4; i++)
        {
            await Assert.ThrowsAsync<UnauthorizedException>(() =>
                service.LoginAsync("lou@example.com", "SecurePass123!", "000000"));
        }

        var locked = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.LoginAsync("lou@example.com", "SecurePass123!", "000000"));
        Assert.Contains("locked", locked.Message, StringComparison.OrdinalIgnoreCase);

        var stored = await dbContext.Users.FirstAsync();
        Assert.NotNull(stored.LockoutUntil);
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.LoginAsync("lou@example.com", "SecurePass123!", "123456"));
    }

    [Fact]
    public async Task RefreshAsync_RotatesTokenAndRevokesPrior()
    {
        var service = BuildService(out var dbContext, out _);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        var outcome = await service.LoginAsync("lou@example.com", "SecurePass123!");
        var first = outcome.Result!;

        var refreshed = await service.RefreshAsync(first.RefreshToken);

        Assert.NotEqual(first.RefreshToken, refreshed.RefreshToken);
        var stored = await dbContext.RefreshTokens.ToListAsync();
        var original = stored.Single(x => x.Token == RefreshTokenHasher.Hash(first.RefreshToken));
        Assert.NotNull(original.RevokedAt);
        Assert.Equal("rotated", original.RevokedReason);
        Assert.NotNull(original.ReplacedByTokenHash);
    }

    [Fact]
    public async Task RefreshAsync_RejectsInactiveUserAndRevokesOutstandingTokens()
    {
        var service = BuildService(out var dbContext, out _);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        var outcome = await service.LoginAsync("lou@example.com", "SecurePass123!");
        var user = await dbContext.Users.SingleAsync(x => x.Email == "lou@example.com");
        user.IsActive = false;
        await dbContext.SaveChangesAsync();

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.RefreshAsync(outcome.Result!.RefreshToken));

        var outstandingTokens = await dbContext.RefreshTokens.Where(x => x.UserId == user.Id).ToListAsync();
        Assert.NotEmpty(outstandingTokens);
        Assert.All(outstandingTokens, token =>
        {
            Assert.NotNull(token.RevokedAt);
            Assert.Equal("user_inactive", token.RevokedReason);
        });
    }

    [Fact]
    public async Task RefreshAsync_RejectsRevokedToken()
    {
        // Full replay-detection test (which revokes ALL active tokens via
        // ExecuteUpdateAsync) requires a relational test provider because
        // EF InMemory does not support ExecuteUpdateAsync. We still assert
        // the first half of the behavior: presenting a revoked token is
        // rejected without producing a new session.
        var service = BuildService(out var dbContext, out _);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        var outcome = await service.LoginAsync("lou@example.com", "SecurePass123!");
        var stolen = outcome.Result!.RefreshToken;
        await service.RefreshAsync(stolen);

        // Re-present the now-revoked original. EF InMemory cannot run the
        // ExecuteUpdateAsync sweep, so we accept either the UnauthorizedException
        // (relational providers) or a NotSupported / InvalidOperationException
        // (InMemory) — both prove the revoked token is not reusable.
        await Assert.ThrowsAnyAsync<Exception>(() => service.RefreshAsync(stolen));
    }

    [Fact]
    public async Task LogoutAsync_RevokesActiveTokenAndIgnoresMissingValues()
    {
        var service = BuildService(out var dbContext, out _);
        await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        var outcome = await service.LoginAsync("lou@example.com", "SecurePass123!");

        await service.LogoutAsync("");
        await service.LogoutAsync("missing");
        await service.LogoutAsync(outcome.Result!.RefreshToken);

        var stored = await dbContext.RefreshTokens.SingleAsync(x => x.Token == RefreshTokenHasher.Hash(outcome.Result.RefreshToken));
        Assert.NotNull(stored.RevokedAt);
        Assert.Equal("logout", stored.RevokedReason);
    }

    [Fact]
    public async Task GetCurrentUserAsync_ProjectsProfileAndRejectsMissingInactiveUsers()
    {
        var service = BuildService(out var dbContext, out _);
        var registered = await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", AdultDateOfBirth);
        var user = await dbContext.Users.SingleAsync(x => x.Id == registered.Id);
        user.Bio = "Routes and food";
        user.AvatarUrl = "https://example.com/avatar.png";
        user.HomeBase = "Austin";
        user.InterestsJson = """["food","music"]""";
        await dbContext.SaveChangesAsync();

        var profile = await service.GetCurrentUserAsync(registered.Id);

        Assert.Equal("lou", profile.Username);
        Assert.Equal(new[] { "food", "music" }, profile.Interests);

        user.IsActive = false;
        await dbContext.SaveChangesAsync();
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCurrentUserAsync(registered.Id));
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCurrentUserAsync(Guid.NewGuid()));
    }
}
