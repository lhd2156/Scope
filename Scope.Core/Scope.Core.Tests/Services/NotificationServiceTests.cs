using System.Text.Json;
using Scope.Core.API.Hubs;
using Scope.Core.API.Services;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class NotificationServiceTests
{
    [Fact]
    public async Task CreateAsync_PersistsQueuesAndPublishesRealtimeNotification()
    {
        await using var dbContext = CreateDbContext();
        var recipient = BuildUser(displayName: "Recipient");
        var actor = BuildUser(displayName: "Actor");
        dbContext.Users.AddRange(recipient, actor);
        dbContext.NotificationPreferences.Add(new NotificationPreference
        {
            Id = Guid.NewGuid(),
            UserId = recipient.Id,
            Category = "trip",
            InAppEnabled = true,
            PushEnabled = true,
            EmailEnabled = true,
            DigestCadence = "instant",
            TimeZoneId = "UTC",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var (service, clientProxy) = CreateService(dbContext);

        var notification = await service.CreateAsync(new NotificationCreateRequest(
            recipient.Id,
            "trip.member.added",
            "trip.member.added",
            "trip",
            "urgent",
            "Trip invite",
            "Actor added you to Austin Loop.",
            "/trips/trip-1",
            actor.Id,
            "trip",
            "trip-1",
            "trip.member.added:event-1:recipient"));

        Assert.NotNull(notification);
        Assert.Equal(notification!.Id, (await dbContext.Notifications.SingleAsync()).Id);
        Assert.Equal(new[] { "email", "push" }, (await dbContext.NotificationDeliveries.Select(x => x.Channel).ToListAsync()).Order().ToArray());
        clientProxy.Verify(
            x => x.SendCoreAsync(
                "NotificationReceived",
                It.IsAny<object[]>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task CreateAsync_DedupesBySourceEventIdWithoutRequeueingOrRepublishing()
    {
        await using var dbContext = CreateDbContext();
        var recipient = BuildUser(displayName: "Recipient");
        var actor = BuildUser(displayName: "Actor");
        dbContext.Users.AddRange(recipient, actor);
        await dbContext.SaveChangesAsync();

        var (service, clientProxy) = CreateService(dbContext);
        var request = new NotificationCreateRequest(
            recipient.Id,
            "friend.request",
            "friend.request",
            "friend",
            "normal",
            "Friend request",
            "Actor wants to connect.",
            "/friends",
            actor.Id,
            "friendship",
            actor.Id.ToString(),
            "friend.request:event-1:recipient");

        var first = await service.CreateAsync(request);
        var second = await service.CreateAsync(request with { Title = "Duplicate title" });

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first!.Id, second!.Id);
        Assert.Single(await dbContext.Notifications.ToListAsync());
        Assert.Single(await dbContext.NotificationDeliveries.ToListAsync());
        clientProxy.Verify(
            x => x.SendCoreAsync("NotificationReceived", It.IsAny<object[]>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task CreateAsync_SuppressesSelfInactiveAndBlockedNotifications()
    {
        await using var dbContext = CreateDbContext();
        var activeUser = BuildUser(displayName: "Active");
        var actor = BuildUser(displayName: "Actor");
        var inactiveUser = BuildUser(displayName: "Inactive", isActive: false);
        dbContext.Users.AddRange(activeUser, actor, inactiveUser);
        dbContext.UserBlocks.Add(new UserBlock
        {
            Id = Guid.NewGuid(),
            BlockerId = activeUser.Id,
            BlockedId = actor.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var (service, clientProxy) = CreateService(dbContext);

        var self = await service.CreateAsync(new NotificationCreateRequest(
            activeUser.Id,
            "spot.liked",
            "spot.liked",
            "social",
            "normal",
            "Spot liked",
            ActorUserId: activeUser.Id));
        var inactive = await service.CreateAsync(new NotificationCreateRequest(
            inactiveUser.Id,
            "security.password.changed",
            "security.password.changed",
            "security",
            "urgent",
            "Password changed"));
        var blocked = await service.CreateAsync(new NotificationCreateRequest(
            activeUser.Id,
            "comment.created",
            "comment.created",
            "comment",
            "normal",
            "New comment",
            ActorUserId: actor.Id));

        Assert.Null(self);
        Assert.Null(inactive);
        Assert.Null(blocked);
        Assert.Empty(await dbContext.Notifications.ToListAsync());
        Assert.Empty(await dbContext.NotificationDeliveries.ToListAsync());
        clientProxy.Verify(
            x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object[]>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateAsync_RespectsChannelPreferencesAndQuietHours()
    {
        await using var dbContext = CreateDbContext();
        var recipient = BuildUser(displayName: "Recipient");
        dbContext.Users.Add(recipient);
        var minuteOfDay = (DateTimeOffset.UtcNow.UtcDateTime.Hour * 60) + DateTimeOffset.UtcNow.UtcDateTime.Minute;
        dbContext.NotificationPreferences.Add(new NotificationPreference
        {
            Id = Guid.NewGuid(),
            UserId = recipient.Id,
            Category = "security",
            InAppEnabled = true,
            PushEnabled = false,
            EmailEnabled = true,
            DigestCadence = "instant",
            QuietHoursStartMinutes = (minuteOfDay + 1439) % 1440,
            QuietHoursEndMinutes = (minuteOfDay + 60) % 1440,
            TimeZoneId = "UTC",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var (service, _) = CreateService(dbContext);
        var beforeCreate = DateTimeOffset.UtcNow;

        await service.CreateAsync(new NotificationCreateRequest(
            recipient.Id,
            "security.password.changed",
            "security.password.changed",
            "security",
            "normal",
            "Password changed"));

        var delivery = await dbContext.NotificationDeliveries.SingleAsync();
        Assert.Equal("email", delivery.Channel);
        Assert.Equal("pending", delivery.Status);
        Assert.True(delivery.NextAttemptAt > beforeCreate.AddMinutes(30));
    }

    [Fact]
    public async Task UpsertFriendActivityDigest_DedupesItemsAndRefreshesDigest()
    {
        await using var dbContext = CreateDbContext();
        var recipient = BuildUser(displayName: "Recipient");
        var actor = BuildUser(displayName: "Actor");
        dbContext.Users.AddRange(recipient, actor);
        await dbContext.SaveChangesAsync();

        var (service, _) = CreateService(dbContext);
        var firstItem = new NotificationDigestItem(
            "spot.created",
            "Actor posted Tacos",
            "A good spot",
            "/spots/spot-1",
            actor.Id,
            "spot",
            "spot-1",
            DateTimeOffset.UtcNow);
        var secondItem = firstItem with
        {
            Title = "Actor posted Coffee",
            ReferenceId = "spot-2",
            ActionUrl = "/spots/spot-2",
        };

        var first = await service.UpsertFriendActivityDigestAsync(recipient.Id, firstItem);
        var duplicate = await service.UpsertFriendActivityDigestAsync(recipient.Id, firstItem);
        var updated = await service.UpsertFriendActivityDigestAsync(recipient.Id, secondItem);

        Assert.NotNull(first);
        Assert.NotNull(duplicate);
        Assert.NotNull(updated);
        Assert.Equal(first!.Id, duplicate!.Id);
        Assert.Equal(first.Id, updated!.Id);
        Assert.Single(await dbContext.Notifications.ToListAsync());
        Assert.Single(await dbContext.NotificationDeliveries.ToListAsync());
        Assert.Contains("2 friend updates today", updated.Title);
        using var metadata = JsonDocument.Parse(updated.MetadataJson!);
        Assert.Equal(2, metadata.RootElement.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task ProcessOutboxRecordAsync_CreatesCommentNotificationsForOwnerAndParentOnlyOnce()
    {
        await using var dbContext = CreateDbContext();
        var actor = BuildUser(displayName: "Maya");
        var owner = BuildUser(displayName: "Owner");
        var parentAuthor = BuildUser(displayName: "Parent");
        dbContext.Users.AddRange(actor, owner, parentAuthor);
        var outbox = new NotificationOutbox
        {
            Id = Guid.NewGuid(),
            SourceEventId = "comment.created:event-1",
            EventType = "comment.created",
            PayloadJson = JsonSerializer.Serialize(new
            {
                eventType = "comment.created",
                eventId = "comment.created:event-1",
                data = new
                {
                    commentId = "comment-1",
                    userId = actor.Id,
                    targetType = "spot",
                    targetId = "spot-1",
                    targetTitle = "Sunset Tacos",
                    targetOwnerUserId = owner.Id,
                    parentCommentUserId = parentAuthor.Id,
                    bodyExcerpt = "Count me in.",
                },
            }),
            Status = "pending",
            AvailableAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.NotificationOutbox.Add(outbox);
        await dbContext.SaveChangesAsync();

        await NotificationEventConsumerService.ProcessOutboxRecordAsync(
            CreateServiceProvider(dbContext),
            outbox,
            CancellationToken.None);

        var notifications = await dbContext.Notifications.OrderBy(x => x.UserId).ToListAsync();
        Assert.Equal("processed", outbox.Status);
        Assert.Equal(2, notifications.Count);
        Assert.Equal(new[] { owner.Id, parentAuthor.Id }.Order().ToArray(), notifications.Select(x => x.UserId).Order().ToArray());
        Assert.All(notifications, notification =>
        {
            Assert.Equal("comment.created", notification.Type);
            Assert.Equal(actor.Id, notification.ActorUserId);
            Assert.StartsWith("comment.created:event-1:", notification.SourceEventId);
        });
    }

    [Fact]
    public async Task ProcessOutboxRecordAsync_CreatesMentionNotificationsForDistinctMentionedUsers()
    {
        await using var dbContext = CreateDbContext();
        var actor = BuildUser(displayName: "Maya");
        var mentioned = BuildUser(displayName: "Mentioned");
        dbContext.Users.AddRange(actor, mentioned);
        var outbox = new NotificationOutbox
        {
            Id = Guid.NewGuid(),
            SourceEventId = "mention.created:event-1",
            EventType = "mention.created",
            PayloadJson = JsonSerializer.Serialize(new
            {
                data = new
                {
                    commentId = "comment-1",
                    userId = actor.Id,
                    targetType = "trip",
                    targetId = "trip-1",
                    mentionedUserIds = new[] { mentioned.Id, mentioned.Id, actor.Id },
                },
            }),
            Status = "pending",
            AvailableAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.NotificationOutbox.Add(outbox);
        await dbContext.SaveChangesAsync();

        await NotificationEventConsumerService.ProcessOutboxRecordAsync(
            CreateServiceProvider(dbContext),
            outbox,
            CancellationToken.None);

        var notification = await dbContext.Notifications.SingleAsync();
        Assert.Equal("processed", outbox.Status);
        Assert.Equal(mentioned.Id, notification.UserId);
        Assert.Equal("mention.created", notification.Type);
        Assert.Equal("/trips/trip-1?comment=comment-1", notification.ActionUrl);
        Assert.Single(await dbContext.NotificationDeliveries.ToListAsync());
    }

    private static CoreDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CoreDbContext(options);
    }

    private static (NotificationService Service, Mock<IClientProxy> ClientProxy) CreateService(CoreDbContext dbContext)
    {
        var hubContext = CreateHubContext(out var clientProxy);
        return (new NotificationService(dbContext, hubContext.Object, NullLogger<NotificationService>.Instance), clientProxy);
    }

    private static ServiceProvider CreateServiceProvider(CoreDbContext dbContext)
    {
        var services = new ServiceCollection();
        var hubContext = CreateHubContext(out _);
        services.AddSingleton(dbContext);
        services.AddSingleton(hubContext.Object);
        services.AddSingleton<INotificationService, NotificationService>();
        services.AddSingleton<ILogger<NotificationService>>(NullLogger<NotificationService>.Instance);
        return services.BuildServiceProvider();
    }

    private static Mock<IHubContext<NotificationHub>> CreateHubContext(out Mock<IClientProxy> clientProxy)
    {
        clientProxy = new Mock<IClientProxy>();
        var clients = new Mock<IHubClients>();
        clients.Setup(x => x.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        var hubContext = new Mock<IHubContext<NotificationHub>>();
        hubContext.Setup(x => x.Clients).Returns(clients.Object);
        return hubContext;
    }

    private static User BuildUser(string displayName, bool isActive = true)
    {
        var suffix = Guid.NewGuid().ToString("N")[..8];
        return new User
        {
            Id = Guid.NewGuid(),
            Username = $"{displayName.ToLowerInvariant()}-{suffix}",
            Email = $"{displayName.ToLowerInvariant()}-{suffix}@example.com",
            DisplayName = displayName,
            PasswordHash = "hash",
            IsActive = isActive,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };
    }
}
