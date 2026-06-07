using Scope.Core.Infrastructure.AI;
using Scope.Core.Infrastructure.Configuration;
using Scope.Core.Infrastructure.GrpcClients;
using Scope.Core.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using WebPush;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class AuthAndExternalMoreTests
{
    [Fact]
    public async Task AuthService_RegisterRefreshAndLogout_CoverAdditionalValidationBranches()
    {
        var service = BuildService(out var dbContext);

        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.ValidationException>(() =>
            service.RegisterAsync("", "lou@example.com", "SecurePass123!", "Lou", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24))));
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.ValidationException>(() =>
            service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "   ", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24))));
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.ValidationException>(() =>
            service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1))));
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.ValidationException>(() =>
            service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-130))));
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.ValidationException>(() =>
            service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24)), "12"));
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.ValidationException>(() =>
            service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24)), "+1 (555) 123-4567"));

        var registered = await service.RegisterAsync("lou", "lou@example.com", "SecurePass123!", "Lou", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24)));
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.ConflictException>(() =>
            service.RegisterAsync("lou2", "lou@example.com", "SecurePass123!", "Lou", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24))));

        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.UnauthorizedException>(() => service.RefreshAsync(""));
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.UnauthorizedException>(() => service.RefreshAsync("missing"));

        dbContext.RefreshTokens.Add(new Scope.Core.Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = registered.Id,
            Token = RefreshTokenHasher.Hash("expired"),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1),
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
        });
        await dbContext.SaveChangesAsync();
        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.UnauthorizedException>(() => service.RefreshAsync("expired"));

        var expired = await dbContext.RefreshTokens.SingleAsync(x => x.Token == RefreshTokenHasher.Hash("expired"));
        Assert.Equal("expired", expired.RevokedReason);
    }

    [Fact]
    public async Task AuthService_LoginMfaAuditAndProfileParsing_CoverRemainingBranches()
    {
        var mfa = new Mock<Scope.Core.Domain.Interfaces.IMfaService>();
        mfa.Setup(x => x.ValidateAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var service = BuildService(out var dbContext, mfa.Object);

        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.UnauthorizedException>(() =>
            service.LoginAsync("missing@example.com", "wrong"));

        var registered = await service.RegisterAsync("mfauser", "mfa@example.com", "SecurePass123!", "Mfa User", DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-24)));
        var user = await dbContext.Users.SingleAsync(x => x.Id == registered.Id);
        user.MfaEnabled = true;
        user.MfaSecret = "JBSWY3DPEHPK3PXP";
        await dbContext.SaveChangesAsync();

        await Assert.ThrowsAsync<Scope.Core.Domain.Exceptions.UnauthorizedException>(() =>
            service.LoginAsync("mfa@example.com", "SecurePass123!", "000000"));

        user.MfaEnabled = false;
        user.InterestsJson = "";
        await dbContext.SaveChangesAsync();
        Assert.Empty((await service.GetCurrentUserAsync(user.Id)).Interests);

        user.InterestsJson = "not-json";
        await dbContext.SaveChangesAsync();
        Assert.Empty((await service.GetCurrentUserAsync(user.Id)).Interests);
    }

    [Fact]
    public async Task WebPushSender_WithSubscriptionCoversPayloadLoopFailurePath()
    {
        await using var dbContext = TestData.CreateDbContext();
        var keys = VapidHelper.GenerateVapidKeys();
        var userId = Guid.NewGuid();
        dbContext.PushSubscriptions.Add(new Scope.Core.Domain.Entities.PushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Endpoint = "https://127.0.0.1:1/push",
            P256dh = "p256dh",
            Auth = "auth",
            IsEnabled = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();
        var sender = new Scope.Core.API.Services.WebPushNotificationSender(
            dbContext,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WEB_PUSH_PUBLIC_KEY"] = keys.PublicKey,
                ["WEB_PUSH_PRIVATE_KEY"] = keys.PrivateKey,
                ["WEB_PUSH_SUBJECT"] = "mailto:test@example.com",
            }).Build(),
            NullLogger<Scope.Core.API.Services.WebPushNotificationSender>.Instance);
        var notification = new Scope.Core.Domain.Entities.Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "n",
            TemplateKey = "n",
            Category = "general",
            Priority = "normal",
            Title = "Title",
            Body = "Body",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var delivery = new Scope.Core.Domain.Entities.NotificationDelivery
        {
            Id = Guid.NewGuid(),
            NotificationId = notification.Id,
            UserId = userId,
            Channel = "push",
            Status = "pending",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            NextAttemptAt = DateTimeOffset.UtcNow,
            Notification = notification,
        };

        var result = await sender.SendAsync(delivery, notification, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("web_push_failed", result.ErrorCode);
    }

    [Fact]
    public async Task KafkaProducer_WithBootstrapAndExternalWrappers_CoverFailureConstructionPaths()
    {
        var kafka = new KafkaProducerService(
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["KAFKA_BOOTSTRAP_SERVERS"] = "127.0.0.1:1",
            }).Build(),
            NullLogger<KafkaProducerService>.Instance);
        await kafka.PublishAsync("topic", new { ok = true });
        kafka.Dispose();

        using var client = new ContentGrpcClient("http://127.0.0.1:1");
        await Assert.ThrowsAnyAsync<Exception>(() => client.GetSpotAsync("spot-1"));
        await Assert.ThrowsAnyAsync<Exception>(() => client.ListSpotsAsync());

        var ai = new ScopeAIService("http://127.0.0.1:1", "llama3.1");
        await Assert.ThrowsAnyAsync<Exception>(() => ai.SummarizeNotifications(["one", "two"]));
        await Assert.ThrowsAnyAsync<Exception>(() => ai.SuggestFriends("user", ["candidate"]));
    }

    private static Scope.Core.Infrastructure.Services.AuthService BuildService(
        out Scope.Core.Infrastructure.Data.CoreDbContext dbContext,
        Scope.Core.Domain.Interfaces.IMfaService? mfa = null)
    {
        dbContext = TestData.CreateDbContext();
        var jwt = new JwtTokenService(Options.Create(new JwtOptions
        {
            Secret = new string('x', 32),
            Issuer = "issuer",
            Audience = "audience",
            AccessTokenMinutes = 15,
            RefreshTokenDays = 7,
        }));
        var breach = new Moq.Mock<Scope.Core.Domain.Interfaces.IPasswordBreachChecker>();
        breach.Setup(x => x.IsBreachedAsync(Moq.It.IsAny<string>(), Moq.It.IsAny<CancellationToken>())).ReturnsAsync(false);
        return new Scope.Core.Infrastructure.Services.AuthService(
            dbContext,
            new PasswordHasherService(),
            jwt,
            new CapturingKafkaProducerService(),
            Options.Create(new JwtOptions { Secret = new string('x', 32), RefreshTokenDays = 7 }),
            new PasswordPolicy(),
            breach.Object,
            mfa ?? Moq.Mock.Of<Scope.Core.Domain.Interfaces.IMfaService>(),
            NullLogger<Scope.Core.Infrastructure.Services.AuthService>.Instance);
    }
}
