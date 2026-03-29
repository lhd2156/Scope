using System.Security.Claims;
using Atlas.Core.API.Hubs;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Hubs;

public sealed class TripHubTests
{
    [Fact]
    public async Task TripHub_JoinsLeavesAndBroadcastsToTripGroup()
    {
        var groupManager = new Mock<IGroupManager>();
        var clientProxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubCallerClients>();
        var context = new Mock<HubCallerContext>();
        context.SetupGet(x => x.ConnectionId).Returns("conn-1");
        clients.Setup(x => x.Group("trip:11111111-1111-1111-1111-111111111111")).Returns(clientProxy.Object);

        var hub = new TripHub
        {
            Context = context.Object,
            Clients = clients.Object,
            Groups = groupManager.Object
        };
        var tripId = Guid.Parse("11111111-1111-1111-1111-111111111111");

        await hub.JoinTrip(tripId);
        await hub.LeaveTrip(tripId);
        await hub.SpotAdded(tripId, new { id = 1 });
        await hub.TripUpdated(tripId, new { title = "Updated" });
        await hub.MemberJoined(tripId, new { id = 2 });

        groupManager.Verify(x => x.AddToGroupAsync("conn-1", $"trip:{tripId}", default), Times.Once);
        groupManager.Verify(x => x.RemoveFromGroupAsync("conn-1", $"trip:{tripId}", default), Times.Once);
        clientProxy.Verify(x => x.SendCoreAsync("SpotAdded", It.Is<object?[]>(args => args.Length == 1), default), Times.Once);
        clientProxy.Verify(x => x.SendCoreAsync("TripUpdated", It.Is<object?[]>(args => args.Length == 1), default), Times.Once);
        clientProxy.Verify(x => x.SendCoreAsync("MemberJoined", It.Is<object?[]>(args => args.Length == 1), default), Times.Once);
    }
}

public sealed class LocationHubTests
{
    [Fact]
    public async Task ShareLocation_UpdatesSessionAndBroadcasts()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        var tripId = Guid.NewGuid();
        dbContext.Users.Add(user);
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = user.Id,
            IsActive = true,
            Latitude = 0,
            Longitude = 0,
            LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        });
        await dbContext.SaveChangesAsync();

        var clientProxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubCallerClients>();
        clients.Setup(x => x.Group($"trip:{tripId}")).Returns(clientProxy.Object);

        var context = new Mock<HubCallerContext>();
        context.SetupGet(x => x.UserIdentifier).Returns(user.Id.ToString());

        var hub = new LocationHub(dbContext)
        {
            Context = context.Object,
            Clients = clients.Object,
            Groups = Mock.Of<IGroupManager>()
        };

        await hub.ShareLocation(tripId, 32.7555, -97.3308);

        Assert.Equal(32.7555, dbContext.LiveSessions.Single().Latitude);
        Assert.Equal(-97.3308, dbContext.LiveSessions.Single().Longitude);
        clientProxy.Verify(x => x.SendCoreAsync("LocationShared", It.Is<object?[]>(args => args.Length == 1), default), Times.Once);
    }

    [Fact]
    public async Task ShareLocation_IgnoresMissingSessionAndStopSharingBroadcasts()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var tripId = Guid.NewGuid();
        var clientProxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubCallerClients>();
        clients.Setup(x => x.Group($"trip:{tripId}")).Returns(clientProxy.Object);

        var context = new Mock<HubCallerContext>();
        context.SetupGet(x => x.UserIdentifier).Returns(Guid.NewGuid().ToString());

        var hub = new LocationHub(dbContext)
        {
            Context = context.Object,
            Clients = clients.Object,
            Groups = Mock.Of<IGroupManager>()
        };

        await hub.ShareLocation(tripId, 1, 2);
        await hub.StopSharing(tripId);

        Assert.Empty(dbContext.LiveSessions);
        clientProxy.Verify(x => x.SendCoreAsync("LocationStopped", It.Is<object?[]>(args => args.Length == 1), default), Times.Once);
    }

    [Fact]
    public async Task ShareLocation_ThrowsWhenUserIdentifierMissing()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var context = new Mock<HubCallerContext>();
        context.SetupGet(x => x.UserIdentifier).Returns((string?)null);
        context.SetupGet(x => x.User).Returns(new ClaimsPrincipal(new ClaimsIdentity()));

        var hub = new LocationHub(dbContext)
        {
            Context = context.Object,
            Clients = Mock.Of<IHubCallerClients>(),
            Groups = Mock.Of<IGroupManager>()
        };

        await Assert.ThrowsAsync<HubException>(() => hub.ShareLocation(Guid.NewGuid(), 1, 2));
    }
}

public sealed class NotificationHubTests
{
    [Fact]
    public async Task OnConnectedAsync_AddsUserSpecificGroupWhenIdentifierPresent()
    {
        var groupManager = new Mock<IGroupManager>();
        var context = new Mock<HubCallerContext>();
        context.SetupGet(x => x.ConnectionId).Returns("conn-1");
        context.SetupGet(x => x.UserIdentifier).Returns(Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").ToString());

        var hub = new NotificationHub
        {
            Context = context.Object,
            Clients = Mock.Of<IHubCallerClients>(),
            Groups = groupManager.Object
        };

        await hub.OnConnectedAsync();

        groupManager.Verify(x => x.AddToGroupAsync("conn-1", "user:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", default), Times.Once);
    }

    [Fact]
    public async Task OnConnectedAsync_SkipsGroupJoinWhenUserIdentifierMissing()
    {
        var groupManager = new Mock<IGroupManager>();
        var context = new Mock<HubCallerContext>();
        context.SetupGet(x => x.ConnectionId).Returns("conn-1");
        context.SetupGet(x => x.UserIdentifier).Returns((string?)null);
        context.SetupGet(x => x.User).Returns(new ClaimsPrincipal(new ClaimsIdentity()));

        var hub = new NotificationHub
        {
            Context = context.Object,
            Clients = Mock.Of<IHubCallerClients>(),
            Groups = groupManager.Object
        };

        await hub.OnConnectedAsync();

        groupManager.Verify(x => x.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }
}
