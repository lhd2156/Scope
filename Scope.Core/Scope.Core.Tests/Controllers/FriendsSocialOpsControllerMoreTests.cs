using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class FriendsSocialOpsControllerMoreTests
{
    [Fact]
    public async Task Friends_CreateAcceptRejectRemovePendingAndSuggestions_CoverStateBranches()
    {
        var callerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var mutualId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.AddRange(
            TestData.User(callerId, "caller", displayName: "Caller", interestsJson: """["food","art"]""", homeBase: "Austin"),
            TestData.User(targetId, "target", displayName: "Target", interestsJson: """["food"]""", homeBase: "Austin"),
            TestData.User(mutualId, "mutual", displayName: "Mutual"),
            TestData.User(candidateId, "candidate", displayName: "Candidate", interestsJson: """["food"]"""));
        dbContext.Friendships.AddRange(
            new Friendship { Id = Guid.NewGuid(), RequesterId = callerId, AddresseeId = mutualId, Status = "accepted", CreatedAt = DateTimeOffset.UtcNow },
            new Friendship { Id = Guid.NewGuid(), RequesterId = candidateId, AddresseeId = mutualId, Status = "accepted", CreatedAt = DateTimeOffset.UtcNow });
        await dbContext.SaveChangesAsync();
        var kafka = new CapturingKafkaProducerService();
        var controller = new FriendsController(dbContext, kafka).WithUser(callerId);

        Assert.IsType<BadRequestObjectResult>(await controller.CreateRequest(callerId, CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.CreateRequest(Guid.NewGuid(), CancellationToken.None));

        var created = await controller.CreateRequest(targetId, CancellationToken.None);
        Assert.IsType<ObjectResult>(created);
        Assert.Single(await dbContext.Notifications.Where(x => x.UserId == targetId && x.Type == "friend.request").ToListAsync());
        Assert.IsType<ConflictObjectResult>(await controller.CreateRequest(targetId, CancellationToken.None));

        var pending = await dbContext.Friendships.SingleAsync(x => x.RequesterId == callerId && x.AddresseeId == targetId);
        var targetController = new FriendsController(dbContext, kafka).WithUser(targetId);
        var pendingList = await targetController.Pending(CancellationToken.None);
        Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(TestData.Response(Assert.IsType<OkObjectResult>(pendingList)).Data));

        var accepted = await targetController.Accept(pending.Id, CancellationToken.None);
        var payload = TestData.Response(Assert.IsType<OkObjectResult>(accepted)).Data;
        Assert.Equal(callerId, TestData.Prop<Guid>(payload, "friendId"));
        Assert.Equal("accepted", pending.Status);
        Assert.Contains(kafka.Published, x => x.Topic == "friend.accepted");
        Assert.IsType<ConflictObjectResult>(await targetController.Accept(pending.Id, CancellationToken.None));

        var listed = await controller.List(-10, 500, CancellationToken.None);
        var listResponse = TestData.Response(Assert.IsType<OkObjectResult>(listed));
        Assert.Contains(Assert.IsAssignableFrom<IEnumerable<object>>(listResponse.Data), x => TestData.Prop<Guid>(x, "friendId") == targetId);
        Assert.Equal(200, TestData.Prop<int>(listResponse.Meta!, "pageSize"));

        var rejected = new Friendship { Id = Guid.NewGuid(), RequesterId = callerId, AddresseeId = targetId, Status = "pending", CreatedAt = DateTimeOffset.UtcNow };
        dbContext.Friendships.Add(rejected);
        await dbContext.SaveChangesAsync();
        Assert.IsType<NoContentResult>(await targetController.Reject(rejected.Id, CancellationToken.None));
        Assert.Contains(kafka.Published, x => x.Topic == "friend.rejected");

        var suggestions = await controller.Suggestions("vibes", 24, CancellationToken.None);
        Assert.Contains(Assert.IsAssignableFrom<IEnumerable<object>>(TestData.Response(Assert.IsType<OkObjectResult>(suggestions)).Data), x => TestData.Prop<Guid>(TestData.Prop<object>(x, "user"), "id") == candidateId);

        Assert.IsType<NoContentResult>(await controller.Remove(pending.Id, CancellationToken.None));
        Assert.Contains(kafka.Published, x => x.Topic == "friend.removed");
        Assert.IsType<NotFoundObjectResult>(await controller.Remove(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task SocialSafety_BlockUnblockReport_CoversValidationAndPersistence()
    {
        var callerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.AddRange(TestData.User(callerId, "caller"), TestData.User(targetId, "target"));
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = targetId,
            AddresseeId = callerId,
            Status = "pending",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();
        var controller = new SocialSafetyController(dbContext).WithUser(callerId);

        Assert.IsType<BadRequestObjectResult>(await controller.Block(callerId, CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.Block(Guid.NewGuid(), CancellationToken.None));

        var block = await controller.Block(targetId, CancellationToken.None);
        Assert.Equal(targetId, Assert.IsType<UserBlock>(TestData.Response(Assert.IsType<OkObjectResult>(block)).Data).BlockedId);
        Assert.Empty(dbContext.Friendships);
        var duplicate = await controller.Block(targetId, CancellationToken.None);
        Assert.Equal(targetId, Assert.IsType<UserBlock>(TestData.Response(Assert.IsType<OkObjectResult>(duplicate)).Data).BlockedId);

        var blocks = await controller.Blocks(CancellationToken.None);
        Assert.Single(Assert.IsAssignableFrom<IEnumerable<UserBlock>>(TestData.Response(Assert.IsType<OkObjectResult>(blocks)).Data));

        var longText = new string('x', 1200);
        var report = await controller.Report(new ReportRequest(targetId, " user ", " target-1 ", longText, longText), CancellationToken.None);
        var reportResult = Assert.IsType<ObjectResult>(report);
        Assert.Equal(StatusCodes.Status201Created, reportResult.StatusCode);
        var saved = Assert.IsType<UserReport>(Assert.IsType<ApiResponse<object>>(reportResult.Value).Data);
        Assert.Equal(80, saved.Reason.Length);
        Assert.Equal(1000, saved.Details!.Length);

        Assert.IsType<NoContentResult>(await controller.Unblock(targetId, CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.Unblock(targetId, CancellationToken.None));
    }

    [Fact]
    public async Task NotificationOps_ListAndReplay_CoverSuccessConflictAndMissing()
    {
        var notificationId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Notifications.Add(new Notification { Id = notificationId, UserId = Guid.NewGuid(), Type = "n", TemplateKey = "n", Category = "general", Priority = "normal", Title = "n", CreatedAt = DateTimeOffset.UtcNow });
        var failedDelivery = new NotificationDelivery { Id = Guid.NewGuid(), NotificationId = notificationId, UserId = Guid.NewGuid(), Channel = "email", Status = "failed", Attempts = 3, NextAttemptAt = DateTimeOffset.UtcNow, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var sentDelivery = new NotificationDelivery { Id = Guid.NewGuid(), NotificationId = notificationId, UserId = Guid.NewGuid(), Channel = "push", Status = "sent", Attempts = 1, NextAttemptAt = DateTimeOffset.UtcNow, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var failedOutbox = new NotificationOutbox { Id = Guid.NewGuid(), SourceEventId = "failed", EventType = "spot.created", PayloadJson = "{}", Status = "failed", Attempts = 2, AvailableAt = DateTimeOffset.UtcNow, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow, LastError = "bad" };
        var processedOutbox = new NotificationOutbox { Id = Guid.NewGuid(), SourceEventId = "done", EventType = "spot.created", PayloadJson = "{}", Status = "processed", AvailableAt = DateTimeOffset.UtcNow, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        dbContext.NotificationDeliveries.AddRange(failedDelivery, sentDelivery);
        dbContext.NotificationOutbox.AddRange(failedOutbox, processedOutbox);
        await dbContext.SaveChangesAsync();
        var controller = new NotificationOpsController(dbContext);

        var deliveries = await controller.Deliveries(" failed ", 999, CancellationToken.None);
        Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(TestData.Response(Assert.IsType<OkObjectResult>(deliveries)).Data));
        var outbox = await controller.Outbox("failed", -10, CancellationToken.None);
        Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(TestData.Response(Assert.IsType<OkObjectResult>(outbox)).Data));

        Assert.IsType<NotFoundObjectResult>(await controller.ReplayDelivery(Guid.NewGuid(), CancellationToken.None));
        Assert.IsType<ConflictObjectResult>(await controller.ReplayDelivery(sentDelivery.Id, CancellationToken.None));
        var replayedDelivery = await controller.ReplayDelivery(failedDelivery.Id, CancellationToken.None);
        Assert.Equal("pending", Assert.IsType<NotificationDelivery>(TestData.Response(Assert.IsType<OkObjectResult>(replayedDelivery)).Data).Status);

        Assert.IsType<NotFoundObjectResult>(await controller.ReplayOutbox(Guid.NewGuid(), CancellationToken.None));
        Assert.IsType<ConflictObjectResult>(await controller.ReplayOutbox(processedOutbox.Id, CancellationToken.None));
        var replayedOutbox = await controller.ReplayOutbox(failedOutbox.Id, CancellationToken.None);
        Assert.Equal("pending", Assert.IsType<NotificationOutbox>(TestData.Response(Assert.IsType<OkObjectResult>(replayedOutbox)).Data).Status);
    }
}
