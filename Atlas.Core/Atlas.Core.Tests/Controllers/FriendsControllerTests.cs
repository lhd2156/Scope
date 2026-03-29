using Atlas.Core.API.Controllers;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class FriendsControllerTests
{
    [Fact]
    public async Task SendRequest_CreatesPendingFriendshipAndNotification()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var requester = TestSupport.CreateUser();
        var target = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        dbContext.Users.AddRange(requester, target);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, requester.Id);

        var result = await controller.SendRequest(target.Id, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, objectResult.StatusCode);
        Assert.Single(dbContext.Friendships);
        Assert.Single(dbContext.Notifications);
        Assert.Equal(FriendshipStatuses.Pending, dbContext.Friendships.Single().Status);
    }

    [Fact]
    public async Task SendRequest_RejectsSelfAndDuplicates()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var requester = TestSupport.CreateUser();
        var target = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        dbContext.Users.AddRange(requester, target);
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = target.Id,
            Status = FriendshipStatuses.Pending,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, requester.Id);

        await Assert.ThrowsAsync<ValidationException>(() => controller.SendRequest(requester.Id, CancellationToken.None));
        await Assert.ThrowsAsync<ConflictException>(() => controller.SendRequest(target.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Accept_ApprovesRequestPublishesEventAndNotifiesRequester()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var requester = TestSupport.CreateUser();
        var addressee = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        var friendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = addressee.Id,
            Status = FriendshipStatuses.Pending,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        dbContext.Users.AddRange(requester, addressee);
        dbContext.Friendships.Add(friendship);
        await dbContext.SaveChangesAsync();

        var kafka = new Mock<IKafkaProducerService>();
        var controller = BuildController(dbContext, kafka.Object);
        TestSupport.AttachUser(controller, addressee.Id);

        var result = await controller.Accept(friendship.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(FriendshipStatuses.Accepted, friendship.Status);
        Assert.Contains(dbContext.Notifications, notification => notification.UserId == requester.Id && notification.Type == NotificationTypes.FriendAccepted);
        kafka.Verify(x => x.PublishAsync(
            KafkaTopics.FriendAccepted,
            It.Is<object>(payload => payload is FriendAcceptedEventData
                && ((FriendAcceptedEventData)payload).FriendshipId == friendship.Id
                && ((FriendAcceptedEventData)payload).RequesterId == requester.Id
                && ((FriendAcceptedEventData)payload).AddresseeId == addressee.Id),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Accept_RejectsWrongRecipientAndWrongStatus()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var requester = TestSupport.CreateUser();
        var addressee = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        var friendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = addressee.Id,
            Status = FriendshipStatuses.Accepted,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        dbContext.Users.AddRange(requester, addressee);
        dbContext.Friendships.Add(friendship);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, requester.Id);
        await Assert.ThrowsAsync<ForbiddenException>(() => controller.Accept(friendship.Id, CancellationToken.None));

        TestSupport.AttachUser(controller, addressee.Id);
        await Assert.ThrowsAsync<UnprocessableException>(() => controller.Accept(friendship.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Decline_UpdatesStatusForPendingRequest()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var requester = TestSupport.CreateUser();
        var addressee = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        var friendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = addressee.Id,
            Status = FriendshipStatuses.Pending,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        dbContext.Users.AddRange(requester, addressee);
        dbContext.Friendships.Add(friendship);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, addressee.Id);

        var result = await controller.Decline(friendship.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(FriendshipStatuses.Declined, friendship.Status);
    }

    [Fact]
    public async Task Delete_RemovesFriendshipForParticipant()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var requester = TestSupport.CreateUser();
        var addressee = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        var friendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = addressee.Id,
            Status = FriendshipStatuses.Accepted,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        dbContext.Users.AddRange(requester, addressee);
        dbContext.Friendships.Add(friendship);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, requester.Id);

        var result = await controller.Delete(friendship.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(dbContext.Friendships);
    }

    [Fact]
    public async Task List_ReturnsAcceptedFriendProfiles()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var currentUser = TestSupport.CreateUser();
        var friend = TestSupport.CreateUser(username: "friend", email: "friend@example.com", displayName: "Friend User");
        dbContext.Users.AddRange(currentUser, friend);
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = currentUser.Id,
            AddresseeId = friend.Id,
            Status = FriendshipStatuses.Accepted,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, currentUser.Id);

        var result = await controller.List(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<Atlas.Core.Domain.Models.ApiResponse<object>>(ok.Value);
        Assert.Contains("Friend User", System.Text.Json.JsonSerializer.Serialize(payload.Data), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Pending_ReturnsPendingRequesterProfiles()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var currentUser = TestSupport.CreateUser();
        var requester = TestSupport.CreateUser(username: "friend", email: "friend@example.com", displayName: "Friend User");
        dbContext.Users.AddRange(currentUser, requester);
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = currentUser.Id,
            Status = FriendshipStatuses.Pending,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, currentUser.Id);

        var result = await controller.Pending(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<Atlas.Core.Domain.Models.ApiResponse<object>>(ok.Value);
        Assert.Contains("Friend User", System.Text.Json.JsonSerializer.Serialize(payload.Data), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Block_CreatesOrUpdatesBlockedFriendship()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var currentUser = TestSupport.CreateUser();
        var targetUser = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        dbContext.Users.AddRange(currentUser, targetUser);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, currentUser.Id);

        var createResult = await controller.Block(targetUser.Id, CancellationToken.None);
        Assert.IsType<OkObjectResult>(createResult);
        Assert.Equal(FriendshipStatuses.Blocked, dbContext.Friendships.Single().Status);

        dbContext.Friendships.Single().Status = FriendshipStatuses.Accepted;
        await dbContext.SaveChangesAsync();

        var updateResult = await controller.Block(targetUser.Id, CancellationToken.None);
        Assert.IsType<OkObjectResult>(updateResult);
        Assert.Equal(FriendshipStatuses.Blocked, dbContext.Friendships.Single().Status);
    }

    private static FriendsController BuildController(CoreDbContext dbContext, IKafkaProducerService? kafkaProducerService = null)
        => new(dbContext, kafkaProducerService ?? Mock.Of<IKafkaProducerService>());
}
