using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class FriendsControllerCoveragePushTests
{
    [Fact]
    public async Task CreateAndAccept_UseNotificationServiceBranchesAndFallbackNames()
    {
        var requesterId = Guid.NewGuid();
        var addresseeId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.Add(TestData.User(addresseeId, "target", displayName: "Target"));
        await dbContext.SaveChangesAsync();

        var notifications = new CapturingNotificationService();
        var kafka = new CapturingKafkaProducerService();
        var requesterController = new FriendsController(dbContext, kafka, notifications).WithUser(requesterId);

        var created = await requesterController.CreateRequest(addresseeId, CancellationToken.None);

        Assert.Equal(201, Assert.IsType<ObjectResult>(created).StatusCode);
        var requestNotification = Assert.Single(notifications.Created);
        Assert.Equal(addresseeId, requestNotification.UserId);
        Assert.Equal("friend.request", requestNotification.Type);
        Assert.Contains("Someone wants to connect", requestNotification.Body);

        var friendship = await dbContext.Friendships.SingleAsync(x => x.RequesterId == requesterId && x.AddresseeId == addresseeId);
        var addresseeController = new FriendsController(dbContext, kafka, notifications).WithUser(addresseeId);

        var accepted = await addresseeController.Accept(friendship.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(accepted);
        Assert.Equal("accepted", friendship.Status);
        Assert.Contains(notifications.Created, x => x.Type == "friend.accepted" && x.UserId == requesterId);
        Assert.Contains(kafka.Published, x => x.Topic == "friend.accepted");

        Assert.IsType<NotFoundObjectResult>(await addresseeController.Accept(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task Reject_CoversMissingAndNonPendingBranches()
    {
        var requesterId = Guid.NewGuid();
        var addresseeId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.AddRange(TestData.User(requesterId, "requester"), TestData.User(addresseeId, "addressee"));
        var accepted = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            AddresseeId = addresseeId,
            Status = "accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.Friendships.Add(accepted);
        await dbContext.SaveChangesAsync();

        var controller = new FriendsController(dbContext, new CapturingKafkaProducerService()).WithUser(addresseeId);

        Assert.IsType<NotFoundObjectResult>(await controller.Reject(Guid.NewGuid(), CancellationToken.None));
        Assert.IsType<ConflictObjectResult>(await controller.Reject(accepted.Id, CancellationToken.None));
    }

    [Fact]
    public async Task ListAndSuggestions_CoverPresenceModesInvalidInterestsAndOrderingModes()
    {
        var callerId = Guid.NewGuid();
        var offlineId = Guid.NewGuid();
        var idleId = Guid.NewGuid();
        var planningId = Guid.NewGuid();
        var onlineId = Guid.NewGuid();
        var sameHomeCandidateId = Guid.NewGuid();
        var freshCandidateId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.AddRange(
            TestData.User(callerId, "caller", displayName: "Caller", interestsJson: """["coffee"]""", homeBase: "Austin"),
            TestData.User(offlineId, "offline", displayName: "Offline", interestsJson: "not-json", homeBase: "Austin"),
            TestData.User(idleId, "idle", displayName: "Idle", interestsJson: """["art"]"""),
            TestData.User(planningId, "planning", displayName: "Planning", interestsJson: """["trails"]"""),
            TestData.User(onlineId, "online", displayName: "Online", interestsJson: """["food"]"""),
            TestData.User(sameHomeCandidateId, "samehome", displayName: "Same Home", homeBase: "Austin"),
            TestData.User(freshCandidateId, "fresh", displayName: "Fresh"));

        dbContext.Friendships.AddRange(
            Accepted(callerId, offlineId),
            Accepted(callerId, idleId),
            Accepted(callerId, planningId),
            Accepted(callerId, onlineId));

        dbContext.UserPresences.AddRange(
            Presence(offlineId, "online", DateTimeOffset.UtcNow.AddMinutes(-20)),
            Presence(idleId, "online", DateTimeOffset.UtcNow, isIdle: true),
            Presence(planningId, "online", DateTimeOffset.UtcNow, lastPlanningAt: DateTimeOffset.UtcNow),
            Presence(onlineId, "online", DateTimeOffset.UtcNow));
        await dbContext.SaveChangesAsync();

        var controller = new FriendsController(dbContext, new CapturingKafkaProducerService()).WithUser(callerId);

        var listed = await controller.List(1, 50, CancellationToken.None);
        var items = Assert.IsAssignableFrom<IEnumerable<object>>(TestData.Response(Assert.IsType<OkObjectResult>(listed)).Data).ToList();
        Assert.Contains(items, x => TestData.Prop<string>(x, "presence") == "offline");
        Assert.Contains(items, x => TestData.Prop<string>(x, "presence") == "idle");
        Assert.Contains(items, x => TestData.Prop<string>(x, "presence") == "planning");
        Assert.Contains(items, x => TestData.Prop<string>(x, "presence") == "online");
        Assert.Contains(items, x => TestData.Prop<string>(x, "nextAdventure").Contains("Mapping fresh routes"));

        var sameHome = await controller.Suggestions("best", 8, CancellationToken.None);
        var sameHomeItems = Assert.IsAssignableFrom<IEnumerable<object>>(TestData.Response(Assert.IsType<OkObjectResult>(sameHome)).Data).ToList();
        Assert.Contains(sameHomeItems, x => TestData.Prop<string>(x, "reason") == "Same home base");
        Assert.Contains(sameHomeItems, x => TestData.Prop<string>(x, "reason") == "Fresh Scope traveler");

        Assert.IsType<OkObjectResult>(await controller.Suggestions("random", 2, CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.Suggestions("mutuals", 2, CancellationToken.None));
    }

    private static Friendship Accepted(Guid requesterId, Guid addresseeId) => new()
    {
        Id = Guid.NewGuid(),
        RequesterId = requesterId,
        AddresseeId = addresseeId,
        Status = "accepted",
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static UserPresence Presence(
        Guid userId,
        string status,
        DateTimeOffset lastActiveAt,
        bool isIdle = false,
        DateTimeOffset? lastPlanningAt = null) => new()
    {
        UserId = userId,
        Status = status,
        IsIdle = isIdle,
        LastActiveAt = lastActiveAt,
        LastPlanningAt = lastPlanningAt,
        UpdatedAt = DateTimeOffset.UtcNow,
    };
}
