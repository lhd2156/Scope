using System.Net;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class AuthHealthLiveControllerMoreTests
{
    [Fact]
    public async Task AuthController_CoversLoginLogoutResetEmailAndMfaEndpoints()
    {
        var userId = Guid.NewGuid();
        var auth = new Mock<IAuthService>();
        var reset = new Mock<IPasswordResetService>();
        var email = new Mock<IEmailVerificationService>();
        var mfa = new Mock<IMfaService>();
        auth.Setup(x => x.LoginAsync("lou@example.com", "pw", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(AuthOutcome.StepUpRequired());
        auth.Setup(x => x.LoginAsync("lou", "pw", "123456", It.IsAny<CancellationToken>()))
            .ReturnsAsync(AuthOutcome.Authenticated(new AuthResult(userId, "lou", "lou@example.com", "Lou", "access", "refresh")));
        auth.Setup(x => x.RefreshAsync("refresh", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AuthResult(userId, "lou", "lou@example.com", "Lou", "access2", "refresh2"));
        auth.Setup(x => x.RefreshAsync(string.Empty, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AuthResult(userId, "lou", "lou@example.com", "Lou", "access3", "refresh3"));
        auth.Setup(x => x.LogoutAsync("refresh", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        auth.Setup(x => x.GetCurrentUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserProfile(userId, "lou", "lou@example.com", "Lou", null, null, null, [], true, "friends", DateTimeOffset.UtcNow));
        reset.Setup(x => x.RequestResetAsync("lou@example.com", "203.0.113.9", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        reset.Setup(x => x.CompleteResetAsync("token", "SecurePass123!", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        email.Setup(x => x.SendAsync(userId, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        email.Setup(x => x.ConfirmAsync("verify", It.IsAny<CancellationToken>())).ReturnsAsync(true);
        mfa.Setup(x => x.StartEnrollmentAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MfaEnrollment("secret", "otpauth://totp/scope", ["AAAAA-BBBBB"]));
        mfa.Setup(x => x.ConfirmAsync(userId, "123456", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        mfa.Setup(x => x.DisableAsync(userId, "123456", It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var controller = new AuthController(auth.Object, reset.Object, email.Object, mfa.Object).WithUser(userId);
        controller.ControllerContext.HttpContext.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.9");

        var mfaRequired = await controller.Login(new LoginRequest("lou@example.com", "pw"), CancellationToken.None);
        Assert.Equal(StatusCodes.Status401Unauthorized, Assert.IsType<ObjectResult>(mfaRequired).StatusCode);
        Assert.Equal("Scope realm=\"mfa\"", controller.Response.Headers["WWW-Authenticate"].ToString());

        Assert.IsType<OkObjectResult>(await controller.Login(new LoginRequest("ignored", "pw", "123456", "lou"), CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.Refresh(new RefreshRequest("refresh"), CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.Refresh(null, CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.Logout(new LogoutRequest("refresh"), CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.Logout(null, CancellationToken.None));
        auth.Verify(x => x.LogoutAsync("refresh", It.IsAny<CancellationToken>()), Times.Once);

        Assert.IsType<OkObjectResult>(await controller.Me(CancellationToken.None));
        var resetResult = await controller.RequestPasswordReset(new PasswordResetRequest("lou@example.com"), CancellationToken.None);
        Assert.Equal(StatusCodes.Status202Accepted, Assert.IsType<ObjectResult>(resetResult).StatusCode);
        reset.Verify(x => x.RequestResetAsync("lou@example.com", "203.0.113.9", It.IsAny<CancellationToken>()), Times.Once);
        Assert.IsType<OkObjectResult>(await controller.CompletePasswordReset(new PasswordResetCompleteRequest("token", "SecurePass123!"), CancellationToken.None));
        reset.Verify(x => x.CompleteResetAsync("token", "SecurePass123!", It.IsAny<CancellationToken>()), Times.Once);

        Assert.IsType<OkObjectResult>(await controller.SendEmailVerification(CancellationToken.None));
        email.Verify(x => x.SendAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
        var confirmed = await controller.ConfirmEmail(new VerifyEmailRequest("verify"), CancellationToken.None);
        Assert.True(TestData.Prop<bool>(TestData.Response(Assert.IsType<OkObjectResult>(confirmed)).Data, "verified"));

        Assert.IsType<OkObjectResult>(await controller.StartMfaEnrollment(CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.ConfirmMfaEnrollment(new MfaConfirmRequest("123456"), CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.DisableMfa(new MfaDisableRequest("123456"), CancellationToken.None));
        mfa.Verify(x => x.ConfirmAsync(userId, "123456", It.IsAny<CancellationToken>()), Times.Once);
        mfa.Verify(x => x.DisableAsync(userId, "123456", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HealthController_ReturnsHealthyPayloadWithoutOptionalDependencies()
    {
        await using var dbContext = TestData.CreateDbContext();
        await dbContext.Database.EnsureCreatedAsync();
        var controller = new HealthController(
            dbContext,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["KAFKA_BOOTSTRAP_SERVERS"] = "localhost:9092",
            }).Build(),
            new ServiceCollection().BuildServiceProvider());

        var result = await controller.Get(CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status200OK, objectResult.StatusCode);
        Assert.Equal("healthy", TestData.Prop<string>(objectResult.Value!, "status"));
    }

    [Fact]
    public async Task HealthController_ReturnsUnhealthyWhenDatabaseCannotConnect()
    {
        var missingDirectory = System.IO.Path.Combine(System.IO.Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        var options = new DbContextOptionsBuilder<Scope.Core.Infrastructure.Data.CoreDbContext>()
            .UseSqlite($"Data Source={System.IO.Path.Combine(missingDirectory, "core.db")}")
            .Options;
        await using var dbContext = new Scope.Core.Infrastructure.Data.CoreDbContext(options);
        var controller = new HealthController(
            dbContext,
            new ConfigurationBuilder().Build(),
            new ServiceCollection().BuildServiceProvider());

        var result = await controller.Get(CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, objectResult.StatusCode);
        Assert.Equal("unhealthy", TestData.Prop<string>(objectResult.Value!, "status"));
    }

    [Fact]
    public async Task LiveSessionController_CoversForbidCreatePingTripAndStopBranches()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        var kafka = new CapturingKafkaProducerService();
        var validator = new Mock<ITripMembershipValidator>();
        validator.Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync(true);
        validator.Setup(x => x.IsMemberAsync(It.Is<Guid>(id => id != tripId), userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var controller = CreateLiveController(dbContext, kafka, validator.Object, userId);

        Assert.IsType<ForbidResult>(await controller.Start(Guid.NewGuid(), CancellationToken.None));
        var created = await controller.Start(tripId, CancellationToken.None);
        Assert.Equal(StatusCodes.Status201Created, Assert.IsType<ObjectResult>(created).StatusCode);

        var ping = await controller.Ping(new PingLocationRequest(tripId, 32.1, -97.2), CancellationToken.None);
        var session = Assert.IsType<LiveSession>(TestData.Response(Assert.IsType<OkObjectResult>(ping)).Data);
        Assert.Equal(32.1, session.Latitude);
        Assert.Contains(kafka.Published, x => x.Topic == "live.location.updated");

        var trip = await controller.Trip(tripId, CancellationToken.None);
        Assert.Single(Assert.IsAssignableFrom<IEnumerable<LiveSession>>(TestData.Response(Assert.IsType<OkObjectResult>(trip)).Data));

        Assert.IsType<ForbidResult>(await controller.Stop(Guid.NewGuid(), CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.Stop(tripId, CancellationToken.None));
        Assert.Contains(kafka.Published, x => x.Topic == "live.session.stopped");
        Assert.IsType<NotFoundObjectResult>(await controller.Stop(tripId, CancellationToken.None));
    }

    private static LiveSessionController CreateLiveController(
        Scope.Core.Infrastructure.Data.CoreDbContext dbContext,
        IKafkaProducerService kafka,
        ITripMembershipValidator validator,
        Guid userId)
    {
        var controller = new LiveSessionController(dbContext, kafka, validator).WithUser(userId);
        controller.ControllerContext.HttpContext.Request.Headers["Authorization"] = "Bearer token";
        return controller;
    }
}
