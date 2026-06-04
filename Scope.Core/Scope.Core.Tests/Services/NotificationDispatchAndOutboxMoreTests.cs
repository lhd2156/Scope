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

public sealed class NotificationDispatchAndOutboxMoreTests
{
    [Fact]
    public async Task DispatchBatchAsync_SendsSuppressesRetriesAndHandlesMissingSenders()
    {
        await using var dbContext = TestData.CreateDbContext();
        var userId = Guid.NewGuid();
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "security",
            TemplateKey = "security",
            Category = "security",
            Priority = "urgent",
            Title = "Security",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.Notifications.Add(notification);
        dbContext.NotificationDeliveries.AddRange(
            Delivery(notification, userId, "email", attempts: 0),
            Delivery(notification, userId, "sms", attempts: 1),
            Delivery(notification, userId, "push", attempts: 2),
            Delivery(notification, userId, "fail", attempts: 7));
        await dbContext.SaveChangesAsync();

        var services = new ServiceCollection();
        services.AddSingleton(dbContext);
        services.AddSingleton<INotificationChannelSender>(new FakeSender("email", _ => new NotificationChannelSendResult(true, "provider-1")));
        services.AddSingleton<INotificationChannelSender>(new FakeSender("push", _ => new NotificationChannelSendResult(true, "push-1")));
        services.AddSingleton<INotificationChannelSender>(new FakeSender("fail", _ => new NotificationChannelSendResult(false, null, "rejected", new string('x', 1205))));
        using var provider = services.BuildServiceProvider();
        var dispatcher = new NotificationDeliveryDispatcher(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<NotificationDeliveryDispatcher>.Instance);

        await InvokePrivateBatch(dispatcher);

        var rows = await dbContext.NotificationDeliveries.OrderBy(x => x.Channel).ToListAsync();
        Assert.Equal("sent", rows.Single(x => x.Channel == "email").Status);
        Assert.Equal("provider-1", rows.Single(x => x.Channel == "email").ProviderMessageId);
        Assert.Equal("pending", rows.Single(x => x.Channel == "sms").Status);
        Assert.Equal("sender_missing", rows.Single(x => x.Channel == "sms").ErrorCode);
        Assert.Equal("suppressed", rows.Single(x => x.Channel == "push").Status);
        Assert.Equal("failed", rows.Single(x => x.Channel == "fail").Status);
        Assert.Equal(1000, rows.Single(x => x.Channel == "fail").LastError!.Length);
    }

    [Fact]
    public async Task WebPushAndNoopEmailSenders_CoverConfigurationAndNoSubscriptionPaths()
    {
        await using var dbContext = TestData.CreateDbContext();
        var notification = new Notification { Id = Guid.NewGuid(), UserId = Guid.NewGuid(), Type = "n", TemplateKey = "n", Category = "general", Priority = "normal", Title = "n", CreatedAt = DateTimeOffset.UtcNow };
        var delivery = Delivery(notification, notification.UserId, "push", attempts: 0);

        var missingConfigSender = new WebPushNotificationSender(
            dbContext,
            new ConfigurationBuilder().Build(),
            NullLogger<WebPushNotificationSender>.Instance);
        var missingConfig = await missingConfigSender.SendAsync(delivery, notification, CancellationToken.None);
        Assert.False(missingConfig.Success);
        Assert.Equal("web_push_not_configured", missingConfig.ErrorCode);

        var noSubscriptionSender = new WebPushNotificationSender(
            dbContext,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["WEB_PUSH_PUBLIC_KEY"] = "public",
                ["WEB_PUSH_PRIVATE_KEY"] = "private",
            }).Build(),
            NullLogger<WebPushNotificationSender>.Instance);
        var noSubscription = await noSubscriptionSender.SendAsync(delivery, notification, CancellationToken.None);
        Assert.False(noSubscription.Success);
        Assert.Equal("push_subscription_missing", noSubscription.ErrorCode);

        var email = await new NoopEmailNotificationSender(NullLogger<NoopEmailNotificationSender>.Instance)
            .SendAsync(delivery, notification, CancellationToken.None);
        Assert.True(email.Success);
        Assert.StartsWith("noop-email:", email.ProviderMessageId);
    }

    [Fact]
    public async Task ProcessOutboxRecordAsync_CoversDigestReactionTripAndFailurePaths()
    {
        await using var dbContext = TestData.CreateDbContext();
        var actor = TestData.User(displayName: "Maya");
        var friend = TestData.User(displayName: "Friend");
        var owner = TestData.User(displayName: "Owner");
        dbContext.Users.AddRange(actor, friend, owner);
        dbContext.Friendships.Add(new Friendship { Id = Guid.NewGuid(), RequesterId = actor.Id, AddresseeId = friend.Id, Status = "accepted", CreatedAt = DateTimeOffset.UtcNow });
        var spotOutbox = Outbox("spot.created:event-1", "spot.created", new
        {
            data = new { userId = actor.Id, spotId = "spot-1", title = "Tacos", isPublic = true, occurredAt = DateTimeOffset.UtcNow }
        });
        var likeOutbox = Outbox("spot.liked:event-1", "spot.liked", new
        {
            data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "spot-1", spotTitle = "Tacos" }
        });
        var tripOutbox = Outbox("trip.member.added:event-1", "trip.member.added", new
        {
            data = new { addedUserId = friend.Id, actorUserId = actor.Id, tripId = "trip-1", tripTitle = "Austin" }
        });
        var ignoredOutbox = Outbox("comment.created:ignored", "comment.created", new
        {
            data = new { userId = actor.Id }
        });
        var failingOutbox = Outbox("bad:event-1", "spot.liked", new
        {
            data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "spot-2" }
        });
        dbContext.NotificationOutbox.AddRange(spotOutbox, likeOutbox, tripOutbox, ignoredOutbox, failingOutbox);
        await dbContext.SaveChangesAsync();

        await NotificationEventConsumerService.ProcessOutboxRecordAsync(CreateProvider(dbContext), spotOutbox, CancellationToken.None);
        await NotificationEventConsumerService.ProcessOutboxRecordAsync(CreateProvider(dbContext), likeOutbox, CancellationToken.None);
        await NotificationEventConsumerService.ProcessOutboxRecordAsync(CreateProvider(dbContext), tripOutbox, CancellationToken.None);
        await NotificationEventConsumerService.ProcessOutboxRecordAsync(CreateProvider(dbContext), ignoredOutbox, CancellationToken.None);

        Assert.Equal("processed", spotOutbox.Status);
        Assert.Equal("processed", ignoredOutbox.Status);
        var notifications = await dbContext.Notifications.OrderBy(x => x.Type).ToListAsync();
        Assert.Contains(notifications, x => x.Type == "friend.activity.digest");
        Assert.Contains(notifications, x => x.Type == "spot.liked" && x.UserId == owner.Id);
        Assert.Contains(notifications, x => x.Type == "trip.member.added" && x.UserId == friend.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            NotificationEventConsumerService.ProcessOutboxRecordAsync(CreateProvider(dbContext, failingNotificationService: true), failingOutbox, CancellationToken.None));
        Assert.Equal("failed", failingOutbox.Status);
        Assert.NotNull(failingOutbox.LastError);
    }

    [Fact]
    public async Task PrivateHandleMessageAndReplayDispatcher_CoverOutboxLifecycle()
    {
        await using var dbContext = TestData.CreateDbContext();
        var actor = TestData.User(displayName: "Actor");
        var owner = TestData.User(displayName: "Owner");
        dbContext.Users.AddRange(actor, owner);
        var replay = Outbox("replay:event-1", "trip.member.added", new
        {
            data = new { addedUserId = owner.Id, actorUserId = actor.Id, tripId = "trip-2", tripTitle = "Replay Trip" }
        });
        dbContext.NotificationOutbox.Add(replay);
        await dbContext.SaveChangesAsync();
        using var provider = CreateProvider(dbContext);
        var consumer = new NotificationEventConsumerService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            new ConfigurationBuilder().Build(),
            NullLogger<NotificationEventConsumerService>.Instance);

        await InvokePrivateHandleMessage(
            consumer,
            "spot.liked",
            42,
            JsonSerializer.Serialize(new
            {
                eventType = "spot.liked",
                eventId = "spot.liked:event-42",
                data = new { userId = actor.Id, ownerUserId = owner.Id, spotId = "spot-42", spotTitle = "Coffee" },
            }));
        await InvokePrivateHandleMessage(consumer, "spot.liked", 42, "{}");

        var createdOutbox = await dbContext.NotificationOutbox.SingleAsync(x => x.SourceEventId == "spot.liked:event-42");
        Assert.Equal("processed", createdOutbox.Status);
        Assert.Contains(await dbContext.Notifications.ToListAsync(), x => x.Type == "spot.liked" && x.UserId == owner.Id);

        var replayDispatcher = new NotificationOutboxReplayDispatcher(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<NotificationOutboxReplayDispatcher>.Instance);
        await InvokePrivateReplayBatch(replayDispatcher);
        Assert.Equal("processed", replay.Status);
        Assert.Contains(await dbContext.Notifications.ToListAsync(), x => x.Type == "trip.member.added" && x.UserId == owner.Id);
    }

    private static NotificationDelivery Delivery(Notification notification, Guid userId, string channel, int attempts) => new()
    {
        Id = Guid.NewGuid(),
        NotificationId = notification.Id,
        Notification = notification,
        UserId = userId,
        Channel = channel,
        Status = "pending",
        Attempts = attempts,
        NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(-1),
        CreatedAt = DateTimeOffset.UtcNow,
        UpdatedAt = DateTimeOffset.UtcNow,
    };

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

    private static async Task InvokePrivateBatch(NotificationDeliveryDispatcher dispatcher)
    {
        var method = typeof(NotificationDeliveryDispatcher).GetMethod("DispatchBatchAsync", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationDeliveryDispatcher), "DispatchBatchAsync");
        await (Task)method.Invoke(dispatcher, [CancellationToken.None])!;
    }

    private static async Task InvokePrivateHandleMessage(NotificationEventConsumerService consumer, string topic, long offset, string message)
    {
        var method = typeof(NotificationEventConsumerService).GetMethod("HandleMessageAsync", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationEventConsumerService), "HandleMessageAsync");
        await (Task)method.Invoke(consumer, [topic, offset, message, CancellationToken.None])!;
    }

    private static async Task InvokePrivateReplayBatch(NotificationOutboxReplayDispatcher dispatcher)
    {
        var method = typeof(NotificationOutboxReplayDispatcher).GetMethod("ProcessPendingAsync", BindingFlags.Instance | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(NotificationOutboxReplayDispatcher), "ProcessPendingAsync");
        await (Task)method.Invoke(dispatcher, [CancellationToken.None])!;
    }

    private static ServiceProvider CreateProvider(CoreDbContext dbContext, bool failingNotificationService = false)
    {
        var services = new ServiceCollection();
        services.AddSingleton(dbContext);
        services.AddSingleton(CreateHubContext().Object);
        services.AddSingleton<ILogger<NotificationService>>(NullLogger<NotificationService>.Instance);
        if (failingNotificationService)
        {
            services.AddSingleton<INotificationService>(_ => new ThrowingNotificationService());
        }
        else
        {
            services.AddSingleton<INotificationService, NotificationService>();
        }
        return services.BuildServiceProvider();
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

    private sealed class FakeSender(string channel, Func<NotificationDelivery, NotificationChannelSendResult> result) : INotificationChannelSender
    {
        public string Channel { get; } = channel;

        public Task<NotificationChannelSendResult> SendAsync(NotificationDelivery delivery, Notification notification, CancellationToken cancellationToken)
            => Task.FromResult(result(delivery));
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
}
