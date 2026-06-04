using System.Security.Claims;
using Scope.Core.API.Hubs;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Exceptions;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Connections.Features;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Hubs;

public sealed class HubMoreTests
{
    [Fact]
    public async Task TripHub_CoversMembershipEditorOwnerAndGroupOperations()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        var validator = new Mock<ITripMembershipValidator>();
        validator.Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync(true);
        validator.Setup(x => x.GetRoleAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync("editor");
        var hub = CreateTripHub(userId, validator.Object, out var groups, out var clients, out var proxy);

        await hub.JoinTrip(tripId);
        await hub.LeaveTrip(tripId);
        await hub.SpotAdded(tripId, new { id = "spot-1" });
        await hub.TripUpdated(tripId, new { title = "Updated" });

        groups.Verify(x => x.AddToGroupAsync("connection-1", $"trip:{tripId}", It.IsAny<CancellationToken>()), Times.Once);
        groups.Verify(x => x.RemoveFromGroupAsync("connection-1", $"trip:{tripId}", It.IsAny<CancellationToken>()), Times.Once);
        clients.Verify(x => x.Group($"trip:{tripId}"), Times.Exactly(2));
        proxy.Verify(x => x.SendCoreAsync("SpotAdded", It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
        proxy.Verify(x => x.SendCoreAsync("TripUpdated", It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);

        validator.Setup(x => x.GetRoleAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync("owner");
        await hub.MemberJoined(tripId, new { id = "member-1" });
        proxy.Verify(x => x.SendCoreAsync("MemberJoined", It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task TripHub_RejectsUnauthorizedMemberEditorOwnerAndMissingIdentity()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        var validator = new Mock<ITripMembershipValidator>();
        validator.Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        validator.Setup(x => x.GetRoleAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync("viewer");
        var hub = CreateTripHub(userId, validator.Object, out _, out _, out _);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinTrip(tripId));
        await Assert.ThrowsAsync<HubException>(() => hub.SpotAdded(tripId, new { }));
        await Assert.ThrowsAsync<HubException>(() => hub.TripUpdated(tripId, new { }));
        await Assert.ThrowsAsync<HubException>(() => hub.MemberJoined(tripId, new { }));

        var missingIdentityHub = CreateTripHub(null, validator.Object, out _, out _, out _);
        await Assert.ThrowsAsync<UnauthorizedException>(() => missingIdentityHub.JoinTrip(tripId));
    }

    [Fact]
    public async Task LocationHub_SharesStopsAndIgnoresMissingLiveSession()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = userId,
            Latitude = 1,
            Longitude = 2,
            IsActive = true,
            LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-5),
        });
        await dbContext.SaveChangesAsync();
        var validator = new Mock<ITripMembershipValidator>();
        validator.Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var hub = CreateLocationHub(dbContext, userId, validator.Object, out var clients, out var proxy);

        await hub.ShareLocation(tripId, 32.7, -97.3);
        await hub.ShareLocation(Guid.NewGuid(), 0, 0);
        await hub.StopSharing(Guid.NewGuid());
        await hub.StopSharing(tripId);

        var session = await dbContext.LiveSessions.SingleAsync();
        Assert.Equal(32.7, session.Latitude);
        Assert.Equal(-97.3, session.Longitude);
        Assert.False(session.IsActive);
        clients.Verify(x => x.Group($"trip:{tripId}"), Times.Exactly(2));
        proxy.Verify(x => x.SendCoreAsync("LocationShared", It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
        proxy.Verify(x => x.SendCoreAsync("LocationStopped", It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task LocationHub_RejectsInvalidCoordinatesAndStopsStaleMembership()
    {
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = userId,
            Latitude = 1,
            Longitude = 2,
            IsActive = true,
            LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-5),
        });
        await dbContext.SaveChangesAsync();
        var validator = new Mock<ITripMembershipValidator>();
        validator.Setup(x => x.IsMemberAsync(tripId, userId, "token", It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var hub = CreateLocationHub(dbContext, userId, validator.Object, out var clients, out var proxy);

        await Assert.ThrowsAsync<HubException>(() => hub.ShareLocation(tripId, 91, -97.3));
        await hub.ShareLocation(tripId, 32.7, -97.3);

        var session = await dbContext.LiveSessions.SingleAsync();
        Assert.False(session.IsActive);
        Assert.Equal(1, session.Latitude);
        Assert.Equal(2, session.Longitude);
        clients.Verify(x => x.Group(It.IsAny<string>()), Times.Never);
        proxy.Verify(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object[]>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task NotificationHub_JoinsUserGroupWhenIdentityIsPresent()
    {
        var userId = Guid.NewGuid();
        var hub = new NotificationHub
        {
            Context = CreateHubContext(userId, "token"),
            Groups = Mock.Of<IGroupManager>(),
            Clients = Mock.Of<IHubCallerClients>(),
        };
        var groups = Mock.Get(hub.Groups);

        await hub.OnConnectedAsync();

        groups.Verify(x => x.AddToGroupAsync("connection-1", $"user:{userId}", It.IsAny<CancellationToken>()), Times.Once);

        var anonymous = new NotificationHub
        {
            Context = CreateHubContext(null, null),
            Groups = Mock.Of<IGroupManager>(),
            Clients = Mock.Of<IHubCallerClients>(),
        };
        await anonymous.OnConnectedAsync();
        Mock.Get(anonymous.Groups).Verify(x => x.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static TripHub CreateTripHub(
        Guid? userId,
        ITripMembershipValidator validator,
        out Mock<IGroupManager> groups,
        out Mock<IHubCallerClients> clients,
        out Mock<IClientProxy> proxy)
    {
        proxy = new Mock<IClientProxy>();
        clients = new Mock<IHubCallerClients>();
        clients.Setup(x => x.Group(It.IsAny<string>())).Returns(proxy.Object);
        groups = new Mock<IGroupManager>();
        return new TripHub(validator, NullLogger<TripHub>.Instance)
        {
            Context = CreateHubContext(userId, "token"),
            Groups = groups.Object,
            Clients = clients.Object,
        };
    }

    private static LocationHub CreateLocationHub(
        CoreDbContext dbContext,
        Guid userId,
        ITripMembershipValidator validator,
        out Mock<IHubCallerClients> clients,
        out Mock<IClientProxy> proxy)
    {
        proxy = new Mock<IClientProxy>();
        clients = new Mock<IHubCallerClients>();
        clients.Setup(x => x.Group(It.IsAny<string>())).Returns(proxy.Object);
        return new LocationHub(dbContext, validator)
        {
            Context = CreateHubContext(userId, "token"),
            Groups = Mock.Of<IGroupManager>(),
            Clients = clients.Object,
        };
    }

    private static HubCallerContext CreateHubContext(Guid? userId, string? bearerToken)
    {
        var httpContext = new DefaultHttpContext();
        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            httpContext.Request.Headers["Authorization"] = $"Bearer {bearerToken}";
        }
        if (userId is { } id)
        {
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, id.ToString())
            ], "test"));
        }
        var features = new FeatureCollection();
        features.Set<IHttpContextFeature>(new TestHttpContextFeature { HttpContext = httpContext });

        var context = new Mock<HubCallerContext>();
        context.Setup(x => x.ConnectionId).Returns("connection-1");
        context.Setup(x => x.ConnectionAborted).Returns(CancellationToken.None);
        context.Setup(x => x.Features).Returns(features);
        context.Setup(x => x.User).Returns(httpContext.User);
        context.Setup(x => x.UserIdentifier).Returns(userId?.ToString());
        return context.Object;
    }

    private sealed class TestHttpContextFeature : IHttpContextFeature
    {
        public HttpContext? HttpContext { get; set; }
    }
}
