using Scope.Core.API.Controllers;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class AuthControllerTests
{
    [Fact]
    public async Task Register_ReturnsCreatedResponse()
    {
        var authService = new Mock<IAuthService>();
        var dateOfBirth = new DateOnly(1998, 5, 14);
        authService.Setup(x => x.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis", dateOfBirth, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AuthResult(Guid.NewGuid(), "louis", "louis@example.com", "Louis", "access", "refresh"));

        var controller = new AuthController(
            authService.Object,
            Mock.Of<IPasswordResetService>(),
            Mock.Of<IEmailVerificationService>(),
            Mock.Of<IMfaService>());
        var result = await controller.Register(new RegisterRequest("louis", "louis@example.com", "SecurePass123!", "Louis", dateOfBirth), CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, objectResult.StatusCode);
    }
}
