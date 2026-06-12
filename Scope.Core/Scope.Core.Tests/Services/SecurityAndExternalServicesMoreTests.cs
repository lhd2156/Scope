using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.Configuration;
using Scope.Core.Infrastructure.Data;
using Scope.Core.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class SecurityAndExternalServicesMoreTests
{
    [Fact]
    public async Task EmailVerificationService_CoversSendThrottleConfirmAndExpiry()
    {
        await using var dbContext = TestData.CreateDbContext();
        var user = TestData.User(email: "verify@example.com");
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        var kafka = new CapturingKafkaProducerService();
        var service = new EmailVerificationService(dbContext, kafka, NullLogger<EmailVerificationService>.Instance);

        await Assert.ThrowsAsync<NotFoundException>(() => service.SendAsync(Guid.NewGuid()));
        await service.SendAsync(user.Id);
        Assert.Single(kafka.Published);
        Assert.NotNull(user.EmailVerificationTokenHash);
        var token = GetPayloadValue<string>(kafka.Published.Single().Payload, "token");

        await service.SendAsync(user.Id);
        Assert.Single(kafka.Published);

        Assert.True(await service.ConfirmAsync(token));
        Assert.NotNull(user.EmailVerifiedAt);
        Assert.Null(user.EmailVerificationTokenHash);
        user.EmailVerificationTokenHash = Sha256Hex(token);
        await dbContext.SaveChangesAsync();
        Assert.False(await service.ConfirmAsync(token));

        await Assert.ThrowsAsync<ValidationException>(() => service.ConfirmAsync(" "));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.ConfirmAsync("unknown"));

        var expired = TestData.User(email: "expired@example.com");
        expired.EmailVerificationTokenHash = Sha256Hex("expired-token");
        expired.EmailVerificationSentAt = DateTimeOffset.UtcNow.AddDays(-2);
        dbContext.Users.Add(expired);
        await dbContext.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.ConfirmAsync("expired-token"));
        Assert.Null(expired.EmailVerificationTokenHash);
    }

    [Fact]
    public async Task PasswordResetService_CoversRequestGuardsValidationAndSuccessfulCompletion()
    {
        await using var requestDbContext = TestData.CreateDbContext();
        var requestUser = TestData.User(username: "reset", email: "reset@example.com");
        requestDbContext.Users.Add(requestUser);
        await requestDbContext.SaveChangesAsync();

        var requestKafka = new CapturingKafkaProducerService();
        var requestBreach = new Mock<IPasswordBreachChecker>();
        requestBreach.Setup(x => x.IsBreachedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var requestService = new PasswordResetService(
            requestDbContext,
            new PasswordHasherService(),
            new PasswordPolicy(),
            requestBreach.Object,
            requestKafka,
            logger: NullLogger<PasswordResetService>.Instance);

        await requestService.RequestResetAsync(" ", "1.2.3.4");
        await requestService.RequestResetAsync("missing@example.com", "1.2.3.4");
        Assert.Empty(requestKafka.Published);

        await requestService.RequestResetAsync(" RESET@EXAMPLE.COM ", "1.2.3.4");
        var requestReset = await requestDbContext.PasswordResets.SingleAsync();
        Assert.NotNull(requestReset.RequestIpHash);
        Assert.Single(requestKafka.Published);
        var requestToken = GetPayloadValue<string>(requestKafka.Published.Single().Payload, "token");
        await requestService.RequestResetAsync("reset@example.com", "1.2.3.4");
        Assert.Single(await requestDbContext.PasswordResets.ToListAsync());

        await Assert.ThrowsAsync<ValidationException>(() => requestService.CompleteResetAsync(" ", "SecurePass123!"));
        await Assert.ThrowsAsync<UnauthorizedException>(() => requestService.CompleteResetAsync("wrong", "SecurePass123!"));
        await Assert.ThrowsAsync<ValidationException>(() => requestService.CompleteResetAsync(requestToken, "password"));
        requestBreach.Setup(x => x.IsBreachedAsync("AnotherSecure123!", It.IsAny<CancellationToken>())).ReturnsAsync(true);
        await Assert.ThrowsAsync<ValidationException>(() => requestService.CompleteResetAsync(requestToken, "AnotherSecure123!"));

        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<CoreDbContext>().UseSqlite(connection).Options;
        await using var dbContext = new CoreDbContext(options);
        await dbContext.Database.EnsureCreatedAsync();
        var user = TestData.User(username: "reset", email: "reset@example.com");
        var token = "reset-success-token";
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = Sha256Hex("refresh"),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(1),
            CreatedAt = DateTimeOffset.UtcNow,
        });
        var reset = new PasswordReset
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = Sha256Hex(token),
            CreatedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30),
        };
        dbContext.PasswordResets.Add(reset);
        await dbContext.SaveChangesAsync();

        var kafka = new CapturingKafkaProducerService();
        var breach = new Mock<IPasswordBreachChecker>();
        breach.Setup(x => x.IsBreachedAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var notifications = new CapturingNotificationService();
        var service = new PasswordResetService(
            dbContext,
            new PasswordHasherService(),
            new PasswordPolicy(),
            breach.Object,
            kafka,
            notifications,
            NullLogger<PasswordResetService>.Instance);

        await service.CompleteResetAsync(token, "FreshSecure123!");

        Assert.NotNull(reset.ConsumedAt);
        Assert.NotNull((await dbContext.RefreshTokens.AsNoTracking().SingleAsync()).RevokedAt);
        Assert.Contains(kafka.Published, x => x.Topic == "user.password_reset_completed");
        Assert.Contains(notifications.Created, x => x.Type == "security.password.changed");
    }

    [Fact]
    public async Task TripMembershipValidator_CoversBearerHttpParsingCacheAndFailures()
    {
        var tripId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var handler = new SequenceHandler(
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent($$"""{"data":[{"user_id":"{{userId}}","role":"editor"}]}""")
            },
            new HttpResponseMessage(HttpStatusCode.Forbidden));
        var validator = new TripMembershipValidator(
            new SingleClientFactory(new HttpClient(handler)),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CONTENT_SERVICE_URL"] = "https://content.test/api/content/"
            }).Build(),
            NullLogger<TripMembershipValidator>.Instance);

        Assert.Null(await validator.GetRoleAsync(Guid.NewGuid(), userId, "", CancellationToken.None));
        Assert.Equal("editor", await validator.GetRoleAsync(tripId, userId, "token", CancellationToken.None));
        Assert.True(await validator.IsMemberAsync(tripId, userId, "token", CancellationToken.None));
        Assert.Equal(1, handler.Calls);

        var malformed = new TripMembershipValidator(
            new SingleClientFactory(new HttpClient(new SequenceHandler(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("""{"data":{}}""") }))),
            new ConfigurationBuilder().Build(),
            NullLogger<TripMembershipValidator>.Instance);
        Assert.Null(await malformed.GetRoleAsync(Guid.NewGuid(), Guid.NewGuid(), "token", CancellationToken.None));

        var throwing = new TripMembershipValidator(
            new SingleClientFactory(new HttpClient(new ThrowingHandler())),
            new ConfigurationBuilder().Build(),
            NullLogger<TripMembershipValidator>.Instance);
        Assert.Null(await throwing.GetRoleAsync(Guid.NewGuid(), Guid.NewGuid(), "token", CancellationToken.None));
    }

    [Fact]
    public async Task TripMembershipValidator_HandlesArrayPayloadsFallbackRolesAndMisses()
    {
        var statusTripId = Guid.NewGuid();
        var viewerTripId = Guid.NewGuid();
        var missedTripId = Guid.NewGuid();
        var forbiddenTripId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var handler = new SequenceHandler(
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent($$"""[{},{"user_id":"{{userId}}","status":"accepted"}]""")
            },
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent($$"""[{"user_id":"{{userId}}"}]""")
            },
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent($$"""[{"user_id":"{{otherUserId}}","role":"editor"}]""")
            },
            new HttpResponseMessage(HttpStatusCode.Forbidden));
        var validator = new TripMembershipValidator(
            new ReusableHandlerFactory(handler),
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CONTENT_SERVICE_URL"] = "https://content.test/api/content"
            }).Build(),
            NullLogger<TripMembershipValidator>.Instance);

        Assert.Equal("accepted", await validator.GetRoleAsync(statusTripId, userId, "token", CancellationToken.None));
        Assert.Equal("viewer", await validator.GetRoleAsync(viewerTripId, userId, "token", CancellationToken.None));
        Assert.Null(await validator.GetRoleAsync(missedTripId, userId, "token", CancellationToken.None));
        Assert.Null(await validator.GetRoleAsync(forbiddenTripId, userId, "token", CancellationToken.None));
        Assert.Equal(4, handler.Calls);
    }

    [Fact]
    public async Task JwtAndKafkaServices_CoverTokenCreationAndNoBootstrapPublish()
    {
        var jwt = new JwtTokenService(Options.Create(new JwtOptions
        {
            Secret = new string('s', 40),
            Issuer = "issuer",
            Audience = "audience",
            AccessTokenMinutes = 5,
        }));
        var user = TestData.User(displayName: "Token User");

        var pair = jwt.CreateTokens(user);
        var token = new JwtSecurityTokenHandler().ReadJwtToken(pair.AccessToken);
        Assert.Equal("issuer", token.Issuer);
        Assert.Contains(token.Claims, x => x.Type == JwtRegisteredClaimNames.Email && x.Value == user.Email);
        Assert.False(string.IsNullOrWhiteSpace(pair.RefreshToken));

        Assert.Throws<InvalidOperationException>(() => new JwtTokenService(Options.Create(new JwtOptions())).CreateTokens(user));

        var producer = new KafkaProducerService(new ConfigurationBuilder().Build(), NullLogger<KafkaProducerService>.Instance);
        await producer.PublishAsync("topic", new { ok = true });
        producer.Dispose();
    }

    private static T GetPayloadValue<T>(object payload, string name)
    {
        var value = payload.GetType().GetProperty(name)?.GetValue(payload)
            ?? throw new InvalidOperationException($"Payload property {name} missing.");
        return Assert.IsType<T>(value);
    }

    private static string Sha256Hex(string input)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));

    private sealed class SingleClientFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    private sealed class ReusableHandlerFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class SequenceHandler(params HttpResponseMessage[] responses) : HttpMessageHandler
    {
        private readonly Queue<HttpResponseMessage> responses = new(responses);
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls += 1;
            return Task.FromResult(responses.Count > 0 ? responses.Dequeue() : new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => throw new HttpRequestException("offline");
    }
}
