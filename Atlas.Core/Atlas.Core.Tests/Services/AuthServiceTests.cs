using System.Collections;
using System.Reflection;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Infrastructure.Services;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Services;

[Collection(PasswordResetTicketCollections.SharedPasswordResetTickets)]
public sealed class AuthServiceTests
{
    [Fact]
    public async Task RegisterAsync_CreatesUserRefreshTokenAndPublishesEvent()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var jwt = BuildJwtService();
        var kafka = new Mock<IKafkaProducerService>();
        var service = BuildService(dbContext, jwtTokenService: jwt.Object, kafkaProducerService: kafka.Object);

        var result = await service.RegisterAsync("louis", "LOUIS@example.com", "SecurePass123!", " Louis ");

        Assert.Equal("louis", result.Username);
        Assert.Equal("louis@example.com", dbContext.Users.Single().Email);
        Assert.Single(dbContext.RefreshTokens);
        kafka.Verify(x => x.PublishAsync(
            KafkaTopics.UserRegistered,
            It.Is<object>(payload => payload is UserRegisteredEventData
                && ((UserRegisteredEventData)payload).UserId == dbContext.Users.Single().Id
                && ((UserRegisteredEventData)payload).Username == "louis"
                && ((UserRegisteredEventData)payload).Email == "louis@example.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_RejectsInvalidInputAndDuplicates()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        dbContext.Users.Add(TestSupport.CreateUser());
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext);

        await Assert.ThrowsAsync<ValidationException>(() => service.RegisterAsync("", "", "", ""));
        await Assert.ThrowsAsync<ConflictException>(() => service.RegisterAsync("other", "louis@example.com", "SecurePass123!", "Louis"));
    }

    [Fact]
    public async Task LoginAsync_ValidatesCredentialsAndStoresRefreshToken()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser(passwordHash: new PasswordHasherService().Hash("SecurePass123!"));
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext);
        var result = await service.LoginAsync(user.Email, "SecurePass123!");

        Assert.Equal(user.Id, result.Id);
        Assert.Equal(1, dbContext.RefreshTokens.Count());
        Assert.NotNull(user.LastLoginAt);
        await Assert.ThrowsAsync<ValidationException>(() => service.LoginAsync("", ""));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.LoginAsync(user.Email, "wrong-password"));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.LoginAsync("missing@example.com", "SecurePass123!"));
    }

    [Fact]
    public async Task RefreshAsync_ValidatesMissingInvalidExpiredAndSuccessfulRefresh()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        var activeToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            User = user,
            Token = "active-token",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        var expiredToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            User = user,
            Token = "expired-token",
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-8),
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        };
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.AddRange(activeToken, expiredToken);
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext);

        await Assert.ThrowsAsync<ValidationException>(() => service.RefreshAsync(""));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.RefreshAsync("missing-token"));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.RefreshAsync("expired-token"));

        var result = await service.RefreshAsync("active-token");

        Assert.Equal(user.Id, result.Id);
        Assert.NotNull(activeToken.RevokedAt);
        Assert.Equal(3, dbContext.RefreshTokens.Count());
    }

    [Fact]
    public async Task LogoutAsync_RevokesKnownRefreshTokenAndIgnoresMissingValues()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        var activeToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            User = user,
            Token = "active-token",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.Add(activeToken);
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext);

        await service.LogoutAsync("");
        await service.LogoutAsync("missing-token");
        await service.LogoutAsync("active-token");

        Assert.NotNull(activeToken.RevokedAt);
    }

    [Fact]
    public async Task ForgotPasswordAsync_ValidatesInputAndCreatesResetTicketForKnownUser()
    {
        ClearPasswordResetTickets();
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext);

        await Assert.ThrowsAsync<ValidationException>(() => service.ForgotPasswordAsync(""));
        await service.ForgotPasswordAsync("missing@example.com");
        Assert.Equal(0, GetPasswordResetTicketCount());

        await service.ForgotPasswordAsync(user.Email);

        Assert.Equal(1, GetPasswordResetTicketCount());
    }

    [Fact]
    public async Task ResetPasswordAsync_ValidatesTicketUpdatesPasswordAndRevokesActiveRefreshTokens()
    {
        ClearPasswordResetTickets();
        await using var dbContext = TestSupport.CreateDbContext();
        var passwordHasher = new PasswordHasherService();
        var user = TestSupport.CreateUser(passwordHash: passwordHasher.Hash("OldPassword123!"));
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            User = user,
            Token = "active-token",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.Add(refreshToken);
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext, passwordHasher: passwordHasher);

        await Assert.ThrowsAsync<ValidationException>(() => service.ResetPasswordAsync("", ""));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.ResetPasswordAsync("missing-token", "NewPassword123!"));

        await service.ForgotPasswordAsync(user.Email);
        var resetToken = GetPasswordResetTokenForUser(user.Id);
        await service.ResetPasswordAsync(resetToken, "NewPassword123!");

        Assert.True(passwordHasher.Verify("NewPassword123!", user.PasswordHash));
        Assert.NotNull(refreshToken.RevokedAt);
        Assert.Equal(0, GetPasswordResetTicketCount());
    }

    [Fact]
    public async Task LoginWithCognitoAsync_CreatesUserEnsuresUniqueUsernameAndPublishesEvent()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        dbContext.Users.Add(TestSupport.CreateUser(username: "louisdo", email: "existing@example.com"));
        await dbContext.SaveChangesAsync();

        var kafka = new Mock<IKafkaProducerService>();
        var service = BuildService(dbContext, kafkaProducerService: kafka.Object);

        var result = await service.LoginWithCognitoAsync("louis@example.com", "Louis Do!", "Louis", "subject-1");

        Assert.Equal("louisdo1", dbContext.Users.Single(x => x.Email == "louis@example.com").Username);
        Assert.Equal(result.Id, dbContext.Users.Single(x => x.Email == "louis@example.com").Id);
        Assert.Single(dbContext.Users.Where(x => x.Email == "louis@example.com"));
        kafka.Verify(x => x.PublishAsync(
            KafkaTopics.UserRegistered,
            It.Is<object>(payload => payload is UserRegisteredEventData
                && ((UserRegisteredEventData)payload).UserId == result.Id
                && ((UserRegisteredEventData)payload).Username == "louisdo1"
                && ((UserRegisteredEventData)payload).Email == "louis@example.com"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LoginWithCognitoAsync_ReusesExistingUserAndAddsRefreshToken()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext);
        var result = await service.LoginWithCognitoAsync(user.Email, null, null, null);

        Assert.Equal(user.Id, result.Id);
        Assert.Single(dbContext.Users);
        Assert.Single(dbContext.RefreshTokens);
        Assert.NotNull(user.LastLoginAt);
    }

    [Fact]
    public async Task GetCurrentUserAsync_ReturnsProfileOrThrowsWhenMissing()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var service = BuildService(dbContext);
        var profile = await service.GetCurrentUserAsync(user.Id);

        Assert.Equal(user.Id, profile.Id);
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCurrentUserAsync(Guid.NewGuid()));
    }

    private static AuthService BuildService(
        CoreDbContext dbContext,
        IPasswordHasher? passwordHasher = null,
        IJwtTokenService? jwtTokenService = null,
        IKafkaProducerService? kafkaProducerService = null,
        IConfiguration? configuration = null)
        => new(
            dbContext,
            passwordHasher ?? new PasswordHasherService(),
            jwtTokenService ?? BuildJwtService().Object,
            kafkaProducerService ?? Mock.Of<IKafkaProducerService>(),
            configuration ?? BuildConfiguration());

    private static IConfiguration BuildConfiguration()
        => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [CoreConfigurationKeys.JwtSecret] = new string('s', 64),
                [CoreConfigurationKeys.RefreshTokenDays] = "7"
            })
            .Build();

    private static Mock<IJwtTokenService> BuildJwtService()
    {
        var jwt = new Mock<IJwtTokenService>();
        jwt.Setup(x => x.CreateTokens(It.IsAny<User>()))
            .Returns<User>(user => new TokenPair($"access-{user.Id}", $"refresh-{Guid.NewGuid():N}", DateTimeOffset.UtcNow.AddMinutes(CoreDefaults.AccessTokenLifetimeMinutes)));
        return jwt;
    }

    private static int GetPasswordResetTicketCount()
        => (int)GetPasswordResetTickets().GetType().GetProperty("Count")!.GetValue(GetPasswordResetTickets())!;

    private static string GetPasswordResetTokenForUser(Guid userId)
    {
        var tickets = GetPasswordResetTickets();
        return ((IEnumerable)tickets)
            .Cast<object>()
            .Select(entry => new
            {
                Key = (string)entry.GetType().GetProperty("Key")!.GetValue(entry)!,
                Value = entry.GetType().GetProperty("Value")!.GetValue(entry)!
            })
            .Where(entry => (Guid)entry.Value.GetType().GetProperty("UserId")!.GetValue(entry.Value)! == userId)
            .Select(entry => entry.Key)
            .Single();
    }

    private static void ClearPasswordResetTickets()
        => GetPasswordResetTickets().GetType().GetMethod("Clear")!.Invoke(GetPasswordResetTickets(), []);

    private static object GetPasswordResetTickets()
        => typeof(AuthService)
            .GetField("PasswordResetTickets", BindingFlags.NonPublic | BindingFlags.Static)!
            .GetValue(null)!;
}
