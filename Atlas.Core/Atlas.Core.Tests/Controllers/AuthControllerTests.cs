using Atlas.Core.API.Controllers;
using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class AuthControllerTests
{
    [Fact]
    public async Task Register_ReturnsCreatedResponse()
    {
        var authService = new Mock<IAuthService>();
        authService.Setup(x => x.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AuthResult(Guid.NewGuid(), "louis", "louis@example.com", "Louis", "access", "refresh"));

        var controller = new AuthController(authService.Object);
        var result = await controller.Register(new RegisterRequest("louis", "louis@example.com", "SecurePass123!", "Louis"), CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, objectResult.StatusCode);
    }
}
