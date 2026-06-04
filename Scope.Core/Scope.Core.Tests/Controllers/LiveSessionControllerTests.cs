using System.Security.Claims;
using Scope.Core.API.Controllers;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class LiveSessionControllerTests
{
    [Fact]
    public async Task Ping_ReturnsNotFound_WhenMemberHasNoActiveSession()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        var validator = new Mock<ITripMembershipValidator>();
        validator
            .Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var controller = CreateController(dbContext, validator.Object, userId);

        var result = await controller.Ping(new PingLocationRequest(tripId, 32.7555, -97.3308), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Start_ReusesActiveSession_ForSameTripAndUser()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = userId,
            Latitude = 32.75,
            Longitude = -97.33,
            IsActive = true,
            LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-5),
        });
        await dbContext.SaveChangesAsync();

        var validator = new Mock<ITripMembershipValidator>();
        validator
            .Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var controller = CreateController(dbContext, validator.Object, userId);

        var result = await controller.Start(tripId, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(1, await dbContext.LiveSessions.CountAsync(x => x.TripId == tripId && x.UserId == userId && x.IsActive));
    }

    [Fact]
    public async Task Stop_DeactivatesActiveSession_ForTripMember()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = userId,
            Latitude = 32.75,
            Longitude = -97.33,
            IsActive = true,
            LastPingAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var validator = new Mock<ITripMembershipValidator>();
        validator
            .Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var controller = CreateController(dbContext, validator.Object, userId);

        var result = await controller.Stop(tripId, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.False(await dbContext.LiveSessions.AnyAsync(x => x.TripId == tripId && x.UserId == userId && x.IsActive));
    }

    private static CoreDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CoreDbContext(options);
    }

    private static LiveSessionController CreateController(
        CoreDbContext dbContext,
        ITripMembershipValidator validator,
        Guid userId)
    {
        var controller = new LiveSessionController(dbContext, Mock.Of<IKafkaProducerService>(), validator)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                    ], "test"))
                }
            }
        };
        controller.ControllerContext.HttpContext.Request.Headers["Authorization"] = "Bearer token";
        return controller;
    }
}
