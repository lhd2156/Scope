using Atlas.Core.API.Controllers;
using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class AuthControllerTests
{
    [Fact]
    public async Task Register_ReturnsCreatedResponse()
    {
        var authService = BuildMockAuthService();
        authService.Setup(x => x.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis", It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildAuthResult());

        var controller = new AuthController(authService.Object);

        var result = await controller.Register(new RegisterRequest("louis", "louis@example.com", "SecurePass123!", "Louis"), CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, objectResult.StatusCode);
    }

    [Fact]
    public async Task Login_ReturnsOkResponse()
    {
        var authService = BuildMockAuthService();
        authService.Setup(x => x.LoginAsync("louis@example.com", "SecurePass123!", It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildAuthResult());

        var controller = new AuthController(authService.Object);

        var result = await controller.Login(new LoginRequest("louis@example.com", "SecurePass123!"), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Refresh_ReturnsOkResponse()
    {
        var authService = BuildMockAuthService();
        authService.Setup(x => x.RefreshAsync("refresh-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildAuthResult());

        var controller = new AuthController(authService.Object);

        var result = await controller.Refresh(new RefreshRequest("refresh-token"), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Logout_CallsServiceAndReturnsSuccessEnvelope()
    {
        var authService = BuildMockAuthService();
        authService.Setup(x => x.LogoutAsync("refresh-token", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var controller = new AuthController(authService.Object);

        var result = await controller.Logout(new LogoutRequest("refresh-token"), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        authService.Verify(x => x.LogoutAsync("refresh-token", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ForgotPassword_CallsServiceAndReturnsSuccessEnvelope()
    {
        var authService = BuildMockAuthService();
        authService.Setup(x => x.ForgotPasswordAsync("louis@example.com", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var controller = new AuthController(authService.Object);

        var result = await controller.ForgotPassword(new ForgotPasswordRequest("louis@example.com"), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        authService.Verify(x => x.ForgotPasswordAsync("louis@example.com", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ResetPassword_CallsServiceAndReturnsSuccessEnvelope()
    {
        var authService = BuildMockAuthService();
        authService.Setup(x => x.ResetPasswordAsync("reset-token", "SecurePass123!", It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var controller = new AuthController(authService.Object);

        var result = await controller.ResetPassword(new ResetPasswordRequest("reset-token", "SecurePass123!"), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        authService.Verify(x => x.ResetPasswordAsync("reset-token", "SecurePass123!", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Cognito_ReturnsOkResponse()
    {
        var authService = BuildMockAuthService();
        authService.Setup(x => x.LoginWithCognitoAsync("louis@example.com", "louis", "Louis", "subject-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(BuildAuthResult());

        var controller = new AuthController(authService.Object);

        var result = await controller.Cognito(new CognitoLoginRequest("louis@example.com", "louis", "Louis", "subject-1"), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Me_UsesAuthenticatedUserId()
    {
        var userId = Guid.NewGuid();
        var authService = BuildMockAuthService();
        authService.Setup(x => x.GetCurrentUserAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserProfile(userId, "louis", "louis@example.com", "Louis", "Bio", null, DateTimeOffset.UtcNow));

        var controller = new AuthController(authService.Object);
        TestSupport.AttachUser(controller, userId);

        var result = await controller.Me(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        authService.Verify(x => x.GetCurrentUserAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    private static Mock<IAuthService> BuildMockAuthService() => new(MockBehavior.Strict);

    private static AuthResult BuildAuthResult()
        => new(Guid.NewGuid(), "louis", "louis@example.com", "Louis", "access", "refresh");
}
