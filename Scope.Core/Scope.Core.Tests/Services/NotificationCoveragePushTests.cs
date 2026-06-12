using System.Reflection;
using System.Text.Json;
using Scope.Core.API.Hubs;
using Scope.Core.API.Services;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Confluent.Kafka;
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
    public void ShouldProcessConsumedMessage_RejectsEmptyKafkaResultsAndAcceptsPayloads()
    {
        Assert.False(InvokeShouldProcessConsumedMessage(null));
        Assert.False(InvokeShouldProcessConsumedMessage(new ConsumeResult<string, string>()));
        Assert.False(InvokeShouldProcessConsumedMessage(new ConsumeResult<string, string>
        {
            Message = new Message<string, string> { Key = "k", Value = null! },
        }));
        Assert.True(InvokeShouldProcessConsumedMessage(new ConsumeResult<string, string>
        {
            Message = new Message<string, string> { Key = "k", Value = "{}" },
        }));
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
            Outbox("mention:missing-actor", "mention.created", new { data = new { targetId = "spot-9", commentId = "comment-4" } }),
            Outbox("trip:public-defaults", "trip.created", new { data = new { creatorId = actor.Id, tripId = "trip-public", isPublic = true } }),
            Outbox("spot:liked-target-owner", "spot.liked", new { data = new { userId = Guid.NewGuid(), targetOwnerUserId = owner.Id, spotId = "spot-unknown-actor" } }),
            Outbox("trip-member:fallbacks", "trip.member.added", new { data = new { userId = mentioned.Id, tripId = "trip-ownerless" } }),
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
        Assert.Contains(notifications.Created, x => x.Type == "spot.liked" && x.UserId == owner.Id && x.Body == "Someone liked your spot.");
        Assert.Contains(notifications.Created, x => x.Type == "comment.created" && x.UserId == owner.Id);
        Assert.Contains(notifications.Created, x => x.Type == "comment.created" && x.UserId == parent.Id);
        Assert.Contains(notifications.Created, x => x.Type == "trip.member.added" && x.UserId == mentioned.Id && x.Body == "A trip owner added you to a Scope trip.");
        var mention = Assert.Single(notifications.Created.Where(x => x.Type == "mention.created"));
        Assert.Equal(mentioned.Id, mention.UserId);
        Assert.Contains(notifications.Digests, x =>
            x.UserId == friend.Id &&
            x.Item.Type == "trip.created" &&
            x.Item.Title == "A friend published a trip" &&
            x.Item.ActionUrl == "/trips/trip-public");
    }

    [Fact]
    public async Task ProcessOutboxRecordAsync_CoversRootPayloadParserFallbacksAndFailureTruncation()
    {
        await using var dbContext = TestData.CreateDbContext();
        var actor = TestData.User(displayName: "Actor");
        var owner = TestData.User(displayName: "Owner");
        var friend = TestData.User(displayName: "Friend");
        dbContext.Users.AddRange(actor, owner, friend);
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = actor.Id,
            AddresseeId = friend.Id,
            Status = "accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        });

        var rootPayloadReaction = Outbox("spot:root-payload", "spot.liked", new
        {
            data = "not-an-object",
            userId = actor.Id,
            targetOwnerUserId = owner.Id,
            spotId = "spot-root",
            spotTitle = "Root Spot",
        });
        var publicSpotWithoutFlag = Outbox("spot:no-public-flag", "spot.created", new
        {
            data = new { userId = actor.Id, spotId = "spot-public-default" },
        });
        var reviewWithTitleFallback = Outbox("review:title-fallback", "review.created", new
        {
            data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "spot-review", title = "Title Fallback" },
        });
        var commentWithNoRecipients = Outbox("comment:no-recipients", "comment.created", new
        {
            data = new { userId = actor.Id, targetOwnerUserId = actor.Id, targetType = "spot", targetId = "spot-root", commentId = "comment-root" },
        });
        dbContext.NotificationOutbox.AddRange(rootPayloadReaction, publicSpotWithoutFlag, reviewWithTitleFallback, commentWithNoRecipients);
        await dbContext.SaveChangesAsync();
        var notifications = new CapturingNotificationService();
        using var provider = Provider(dbContext, notifications);

        foreach (var record in new[] { rootPayloadReaction, publicSpotWithoutFlag, reviewWithTitleFallback, commentWithNoRecipients })
        {
            await NotificationEventConsumerService.ProcessOutboxRecordAsync(provider, record, CancellationToken.None);
            Assert.Equal("processed", record.Status);
        }

        Assert.Contains(notifications.Created, x => x.Type == "spot.liked" && x.Body == "Actor liked Root Spot.");
        Assert.Contains(notifications.Created, x => x.Type == "review.created" && x.Body == "Actor left a review on Title Fallback.");
        Assert.DoesNotContain(notifications.Created, x => x.Type == "comment.created" && x.ReferenceId == "comment-root");
        Assert.Contains(notifications.Digests, x =>
            x.UserId == friend.Id &&
            x.Item.Type == "spot.created" &&
            x.Item.Title == "A friend posted a new spot");

        Assert.Empty(InvokeToMetadata("[]"));
        Assert.Empty(InvokeToMetadata("null"));
        Assert.Null(InvokeGetBool("""{"isPublic":"yes"}""", "isPublic"));
        Assert.Contains(actor.Id, InvokeGetGuidArray(JsonSerializer.Serialize(new { mentionedUserIds = new object[] { actor.Id.ToString(), "bad-guid", 123 } }), "mentionedUserIds"));

        var failing = Outbox("spot:long-failure", "spot.liked", new
        {
            data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "spot-failure" },
        });
        dbContext.NotificationOutbox.Add(failing);
        await dbContext.SaveChangesAsync();
        using var failingProvider = Provider(dbContext, new LongThrowingNotificationService());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NotificationEventConsumerService.ProcessOutboxRecordAsync(failingProvider, failing, CancellationToken.None));

        Assert.Equal("failed", failing.Status);
        Assert.Equal(1000, failing.LastError!.Length);
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

    private static bool InvokeShouldProcessConsumedMessage(ConsumeResult<string, string>? result)
    {
        var method = typeof(NotificationEventConsumerService).GetMethod("ShouldProcessConsumedMessage", BindingFlags.Static | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationEventConsumerService), "ShouldProcessConsumedMessage");
        return (bool)method.Invoke(null, [result])!;
    }

    private static IReadOnlyDictionary<string, object?> InvokeToMetadata(string json)
    {
        using var document = JsonDocument.Parse(json);
        var method = typeof(NotificationEventConsumerService).GetMethod("ToMetadata", BindingFlags.Static | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationEventConsumerService), "ToMetadata");
        return (IReadOnlyDictionary<string, object?>)method.Invoke(null, [document.RootElement])!;
    }

    private static bool? InvokeGetBool(string json, string name)
    {
        using var document = JsonDocument.Parse(json);
        var method = typeof(NotificationEventConsumerService).GetMethod("GetBool", BindingFlags.Static | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationEventConsumerService), "GetBool");
        return (bool?)method.Invoke(null, [document.RootElement, name]);
    }

    private static IReadOnlyList<Guid> InvokeGetGuidArray(string json, string name)
    {
        using var document = JsonDocument.Parse(json);
        var method = typeof(NotificationEventConsumerService).GetMethod("GetGuidArray", BindingFlags.Static | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationEventConsumerService), "GetGuidArray");
        return (IReadOnlyList<Guid>)method.Invoke(null, [document.RootElement, name])!;
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

    private sealed class LongThrowingNotificationService : INotificationService
    {
        private static readonly string LongMessage = new('x', 1205);

        public Task<Notification?> CreateAsync(NotificationCreateRequest request, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException(LongMessage);

        public Task<Notification?> UpsertFriendActivityDigestAsync(Guid userId, NotificationDigestItem item, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException(LongMessage);

        public Task QueueDeliveryAttemptsAsync(Notification notification, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException(LongMessage);
    }

    private sealed class ThrowingSender(string channel) : INotificationChannelSender
    {
        public string Channel { get; } = channel;

        public Task<NotificationChannelSendResult> SendAsync(NotificationDelivery delivery, Notification notification, CancellationToken cancellationToken)
            => throw new InvalidOperationException("sender exploded");
    }
}
