using System.Reflection;
using System.Text.Json;
using Scope.Core.API.Hubs;
using Scope.Core.API.Services;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class NotificationCoveragePushTests
{
    [Fact]
    public async Task ConsumerStartAsync_ReturnsImmediatelyWhenKafkaIsDisabled()
    {
        await using var dbContext = TestData.CreateDbContext();
        using var provider = Provider(dbContext, new CapturingNotificationService());
        var consumer = new NotificationEventConsumerService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().Build(),
            NullLogger<NotificationEventConsumerService>.Instance);

        await consumer.StartAsync(CancellationToken.None);
        await consumer.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task ProcessOutboxRecordAsync_CoversAdditionalEventBranchesAndEarlyReturns()
    {
        await using var dbContext = TestData.CreateDbContext();
        var actor = TestData.User(displayName: "Actor");
        var owner = TestData.User(displayName: "Owner");
        var parent = TestData.User(displayName: "Parent");
        var mentioned = TestData.User(displayName: "Mentioned");
        var friend = TestData.User(displayName: "Friend");
        dbContext.Users.AddRange(actor, owner, parent, mentioned, friend);
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = actor.Id,
            AddresseeId = friend.Id,
            Status = "accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        });

        var records = new[]
        {
            Outbox("review:event-1", "review.created", new { data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "spot-7", title = "Viewpoint" } }),
            Outbox("comment:event-1", "comment.created", new { data = new { userId = actor.Id, targetOwnerUserId = owner.Id, parentCommentUserId = parent.Id, targetType = "trip", targetId = "trip-1", commentId = "comment-1", targetTitle = "Trip" } }),
            Outbox("mention:event-1", "mention.created", new { data = new { userId = actor.Id, targetType = "spot", targetId = "spot-7", commentId = "comment-2", mentionedUserIds = new[] { mentioned.Id, actor.Id, mentioned.Id } } }),
            Outbox("mention:missing-array", "mention.created", new { data = new { userId = actor.Id, targetId = "spot-8", commentId = "comment-3" } }),
            Outbox("trip:not-public", "trip.created", new { data = new { userId = actor.Id, tripId = "trip-private", isPublic = false } }),
            Outbox("spot:missing-ref", "spot.created", new { data = new { userId = actor.Id, isPublic = true } }),
            Outbox("trip-member:missing", "trip.member.added", new { data = new { actorUserId = actor.Id } }),
            Outbox("unknown:event", "unknown.event", new { data = new { userId = actor.Id } }),
        };
        dbContext.NotificationOutbox.AddRange(records);
        await dbContext.SaveChangesAsync();
        var notifications = new CapturingNotificationService();
        using var provider = Provider(dbContext, notifications);

        foreach (var record in records)
        {
            await NotificationEventConsumerService.ProcessOutboxRecordAsync(provider, record, CancellationToken.None);
            Assert.Equal("processed", record.Status);
        }

        Assert.Contains(notifications.Created, x => x.Type == "review.created" && x.UserId == owner.Id);
        Assert.Contains(notifications.Created, x => x.Type == "comment.created" && x.UserId == owner.Id);
        Assert.Contains(notifications.Created, x => x.Type == "comment.created" && x.UserId == parent.Id);
        var mention = Assert.Single(notifications.Created.Where(x => x.Type == "mention.created"));
        Assert.Equal(mentioned.Id, mention.UserId);
        Assert.Empty(notifications.Digests);
    }

    [Fact]
    public async Task PrivateHandleMessage_CoversProcessedOutboxSkipAndFailureState()
    {
        await using var dbContext = TestData.CreateDbContext();
        var actor = TestData.User(displayName: "Actor");
        var owner = TestData.User(displayName: "Owner");
        dbContext.Users.AddRange(actor, owner);
        dbContext.NotificationOutbox.Add(new NotificationOutbox
        {
            Id = Guid.NewGuid(),
            SourceEventId = "processed:event-1",
            EventType = "spot.liked",
            PayloadJson = "{}",
            Status = "processed",
            AvailableAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        using var provider = Provider(dbContext, new ThrowingNotificationService());
        var consumer = new NotificationEventConsumerService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().Build(),
            NullLogger<NotificationEventConsumerService>.Instance);

        await InvokeHandleMessage(consumer, "spot.liked", 1, JsonSerializer.Serialize(new
        {
            eventId = "processed:event-1",
            data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "already-done" },
        }));

        await Assert.ThrowsAsync<InvalidOperationException>(() => InvokeHandleMessage(consumer, "spot.liked", 2, JsonSerializer.Serialize(new
        {
            eventId = "failed:event-2",
            data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "will-fail" },
        })));

        var failed = await dbContext.NotificationOutbox.SingleAsync(x => x.SourceEventId == "failed:event-2");
        Assert.Equal("failed", failed.Status);
        Assert.Equal("boom", failed.LastError);
        Assert.True(failed.Attempts > 0);
    }

    [Fact]
    public async Task DispatchBatchAsync_CoversSenderExceptions()
    {
        await using var dbContext = TestData.CreateDbContext();
        var userId = Guid.NewGuid();
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "n",
            TemplateKey = "n",
            Category = "general",
            Priority = "normal",
            Title = "n",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        var delivery = new NotificationDelivery
        {
            Id = Guid.NewGuid(),
            NotificationId = notification.Id,
            Notification = notification,
            UserId = userId,
            Channel = "email",
            Status = "pending",
            Attempts = 0,
            NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-1),
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.Notifications.Add(notification);
        dbContext.NotificationDeliveries.Add(delivery);
        await dbContext.SaveChangesAsync();

        var services = new ServiceCollection();
        services.AddSingleton(dbContext);
        services.AddSingleton<INotificationChannelSender>(new ThrowingSender("email"));
        using var provider = services.BuildServiceProvider();
        var dispatcher = new NotificationDeliveryDispatcher(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<NotificationDeliveryDispatcher>.Instance);

        await InvokeDispatchBatch(dispatcher);

        Assert.Equal("pending", delivery.Status);
        Assert.Equal("dispatch_exception", delivery.ErrorCode);
        Assert.Equal("sender exploded", delivery.LastError);
        Assert.Equal(1, delivery.Attempts);
    }

    [Fact]
    public async Task ReplayDispatcher_CatchesFailedOutboxRecords()
    {
        await using var dbContext = TestData.CreateDbContext();
        var actor = TestData.User(displayName: "Actor");
        var owner = TestData.User(displayName: "Owner");
        dbContext.Users.AddRange(actor, owner);
        var record = Outbox("replay-fail:event-1", "spot.liked", new
        {
            data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "spot-replay" },
        });
        dbContext.NotificationOutbox.Add(record);
        await dbContext.SaveChangesAsync();
        using var provider = Provider(dbContext, new ThrowingNotificationService());
        var dispatcher = new NotificationOutboxReplayDispatcher(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<NotificationOutboxReplayDispatcher>.Instance);

        await InvokeReplayBatch(dispatcher);

        Assert.Equal("failed", record.Status);
        Assert.Equal("boom", record.LastError);
    }

    private static NotificationOutbox Outbox(string sourceEventId, string eventType, object payload) => new()
    {
        Id = Guid.NewGuid(),
        SourceEventId = sourceEventId,
        EventType = eventType,
        PayloadJson = JsonSerializer.Serialize(payload),
        Status = "pending",
        AvailableAt = DateTimeOffset.UtcNow,
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
    };

    private static ServiceProvider Provider(CoreDbContext dbContext, INotificationService notificationService)
    {
        var services = new ServiceCollection();
        services.AddSingleton(dbContext);
        services.AddSingleton(notificationService);
        services.AddSingleton(CreateHubContext().Object);
        services.AddSingleton<ILogger<NotificationService>>(NullLogger<NotificationService>.Instance);
        return services.BuildServiceProvider();
    }

    private static async Task InvokeHandleMessage(NotificationEventConsumerService consumer, string topic, long offset, string message)
    {
        var method = typeof(NotificationEventConsumerService).GetMethod("HandleMessageAsync", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationEventConsumerService), "HandleMessageAsync");
        await (Task)method.Invoke(consumer, [topic, offset, message, CancellationToken.None])!;
    }

    private static async Task InvokeDispatchBatch(NotificationDeliveryDispatcher dispatcher)
    {
        var method = typeof(NotificationDeliveryDispatcher).GetMethod("DispatchBatchAsync", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationDeliveryDispatcher), "DispatchBatchAsync");
        await (Task)method.Invoke(dispatcher, [CancellationToken.None])!;
    }

    private static async Task InvokeReplayBatch(NotificationOutboxReplayDispatcher dispatcher)
    {
        var method = typeof(NotificationOutboxReplayDispatcher).GetMethod("ProcessPendingAsync", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationOutboxReplayDispatcher), "ProcessPendingAsync");
        await (Task)method.Invoke(dispatcher, [CancellationToken.None])!;
    }

    private static Mock<IHubContext<NotificationHub>> CreateHubContext()
    {
        var clientProxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubClients>();
        clients.Setup(x => x.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        var hubContext = new Mock<IHubContext<NotificationHub>>();
        hubContext.Setup(x => x.Clients).Returns(clients.Object);
        return hubContext;
    }

    private sealed class ThrowingNotificationService : INotificationService
    {
        public Task<Notification?> CreateAsync(NotificationCreateRequest request, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("boom");

        public Task<Notification?> UpsertFriendActivityDigestAsync(Guid userId, NotificationDigestItem item, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("boom");

        public Task QueueDeliveryAttemptsAsync(Notification notification, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("boom");
    }

    private sealed class ThrowingSender(string channel) : INotificationChannelSender
    {
        public string Channel { get; } = channel;

        public Task<NotificationChannelSendResult> SendAsync(NotificationDelivery delivery, Notification notification, CancellationToken cancellationToken)
            => throw new InvalidOperationException("sender exploded");
    }
}
