using System.Reflection;
using Scope.Core.API.Hubs;
using Scope.Core.API.Services;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace Scope.Core.Tests.Services;

public sealed class NotificationServiceCoveragePushTests
{
    [Fact]
    public async Task CreateAsync_CoversInvalidActorBlockedAndRealtimeFailureBranches()
    {
        await using var dbContext = TestData.CreateDbContext();
        var user = TestData.User(displayName: "Recipient");
        var actor = TestData.User(displayName: "Actor");
        var blockedActor = TestData.User(displayName: "Blocked");
        dbContext.Users.AddRange(user, actor, blockedActor);
        dbContext.UserBlocks.Add(new UserBlock
        {
            Id = Guid.NewGuid(),
            BlockerId = user.Id,
            BlockedId = blockedActor.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var service = new NotificationService(dbContext, ThrowingHubContext().Object, NullLogger<NotificationService>.Instance);

        Assert.Null(await service.CreateAsync(new NotificationCreateRequest(Guid.Empty, "type", "type", "general", "normal", "title")));
        Assert.Null(await service.CreateAsync(new NotificationCreateRequest(user.Id, "", "type", "general", "normal", "title")));
        Assert.Null(await service.CreateAsync(new NotificationCreateRequest(user.Id, "self", "self", "general", "normal", "title", ActorUserId: user.Id)));
        Assert.Null(await service.CreateAsync(new NotificationCreateRequest(user.Id, "blocked", "blocked", "general", "normal", "title", ActorUserId: blockedActor.Id)));
        Assert.Null(await service.CreateAsync(new NotificationCreateRequest(Guid.NewGuid(), "missing", "missing", "general", "normal", "title")));

        var created = await service.CreateAsync(new NotificationCreateRequest(
            user.Id,
            "friend.request",
            "friend.request",
            "friend",
            "normal",
            "Hello",
            ActorUserId: actor.Id,
            SourceEventId: "source-1"));

        Assert.NotNull(created);
        Assert.Single(await dbContext.NotificationDeliveries.Where(x => x.NotificationId == created!.Id && x.Channel == "push").ToListAsync());

        var duplicate = await service.CreateAsync(new NotificationCreateRequest(
            user.Id,
            "friend.request",
            "friend.request",
            "friend",
            "normal",
            "Hello",
            ActorUserId: actor.Id,
            SourceEventId: "source-1"));

        Assert.Equal(created!.Id, duplicate!.Id);
    }

    [Fact]
    public async Task UpsertFriendActivityDigest_CoversBlockedDuplicateInvalidMetadataAndQuietHours()
    {
        await using var dbContext = TestData.CreateDbContext();
        var recipient = TestData.User(displayName: "Recipient");
        var actor = TestData.User(displayName: "Actor");
        var blocked = TestData.User(displayName: "Blocked");
        dbContext.Users.AddRange(recipient, actor, blocked);
        dbContext.UserBlocks.Add(new UserBlock
        {
            Id = Guid.NewGuid(),
            BlockerId = blocked.Id,
            BlockedId = recipient.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        var now = DateTimeOffset.UtcNow;
        dbContext.NotificationPreferences.Add(new NotificationPreference
        {
            Id = Guid.NewGuid(),
            UserId = recipient.Id,
            Category = "digest",
            InAppEnabled = true,
            PushEnabled = true,
            EmailEnabled = true,
            DigestCadence = "daily",
            QuietHoursStartMinutes = ((now.UtcDateTime.Hour * 60) + now.UtcDateTime.Minute + 60) % 1440,
            QuietHoursEndMinutes = ((now.UtcDateTime.Hour * 60) + now.UtcDateTime.Minute + 120) % 1440,
            TimeZoneId = "UTC",
            CreatedAt = now,
            UpdatedAt = now,
        });
        await dbContext.SaveChangesAsync();

        var service = new NotificationService(dbContext, QuietHubContext().Object, NullLogger<NotificationService>.Instance);
        Assert.Null(await service.UpsertFriendActivityDigestAsync(Guid.Empty, Digest(actor.Id, "spot", "1"), CancellationToken.None));
        Assert.Null(await service.UpsertFriendActivityDigestAsync(recipient.Id, Digest(recipient.Id, "spot", "self"), CancellationToken.None));
        Assert.Null(await service.UpsertFriendActivityDigestAsync(recipient.Id, Digest(blocked.Id, "spot", "blocked"), CancellationToken.None));

        var first = await service.UpsertFriendActivityDigestAsync(recipient.Id, Digest(actor.Id, "spot", "1"), CancellationToken.None);
        Assert.NotNull(first);
        first!.MetadataJson = "{}";
        await dbContext.SaveChangesAsync();
        var second = await service.UpsertFriendActivityDigestAsync(recipient.Id, Digest(actor.Id, "trip", "2"), CancellationToken.None);
        Assert.Equal(first.Id, second!.Id);

        second.MetadataJson = "not-json";
        await dbContext.SaveChangesAsync();
        var third = await service.UpsertFriendActivityDigestAsync(recipient.Id, Digest(actor.Id, "trip", "3"), CancellationToken.None);
        Assert.Equal(first.Id, third!.Id);

        var deliveries = await dbContext.NotificationDeliveries.Where(x => x.NotificationId == first.Id).ToListAsync();
        Assert.Contains(deliveries, x => x.Channel == "email");
        Assert.All(deliveries, delivery => Assert.True(delivery.NextAttemptAt <= DateTimeOffset.UtcNow.AddMinutes(1)));
    }

    [Fact]
    public async Task QueueDeliveryAttempts_CoversNoChannelExistingDeliveryAndQuietHourSchedulingBranches()
    {
        await using var dbContext = TestData.CreateDbContext();
        var user = TestData.User(displayName: "Recipient");
        dbContext.Users.Add(user);
        var general = Notification(user.Id, "general", "normal");
        var security = Notification(user.Id, "security", "normal");
        dbContext.Notifications.AddRange(general, security);
        dbContext.NotificationPreferences.Add(new NotificationPreference
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Category = "security",
            InAppEnabled = true,
            PushEnabled = true,
            EmailEnabled = true,
            DigestCadence = "instant",
            QuietHoursStartMinutes = 0,
            QuietHoursEndMinutes = 60,
            TimeZoneId = "UTC",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.NotificationDeliveries.Add(new NotificationDelivery
        {
            Id = Guid.NewGuid(),
            NotificationId = security.Id,
            UserId = user.Id,
            Channel = "email",
            Status = "pending",
            Attempts = 0,
            NextAttemptAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();
        var service = new NotificationService(dbContext, QuietHubContext().Object, NullLogger<NotificationService>.Instance);

        await service.QueueDeliveryAttemptsAsync(general, CancellationToken.None);
        await service.QueueDeliveryAttemptsAsync(security, CancellationToken.None);

        Assert.Empty(await dbContext.NotificationDeliveries.Where(x => x.NotificationId == general.Id).ToListAsync());
        var securityChannels = await dbContext.NotificationDeliveries
            .Where(x => x.NotificationId == security.Id)
            .Select(x => x.Channel)
            .OrderBy(x => x)
            .ToListAsync();
        Assert.Equal(new[] { "email", "push" }, securityChannels);

        var quietPreference = new NotificationPreference { QuietHoursStartMinutes = 22 * 60, QuietHoursEndMinutes = 2 * 60 };
        var quietNow = new DateTimeOffset(2026, 1, 1, 23, 30, 0, TimeSpan.Zero);
        var normalNext = InvokeResolveNextAttemptAt(quietNow, quietPreference, "normal");
        Assert.Equal(quietNow.AddMinutes(150), normalNext);
        Assert.Equal(quietNow, InvokeResolveNextAttemptAt(quietNow, quietPreference, "urgent"));
        var nonQuietNow = quietNow.AddHours(-12);
        Assert.Equal(nonQuietNow, InvokeResolveNextAttemptAt(nonQuietNow, quietPreference, "normal"));
        Assert.Equal(quietNow, InvokeResolveNextAttemptAt(quietNow, new NotificationPreference(), "normal"));

        Assert.Empty(InvokeReadDigestItems(null));
        Assert.Empty(InvokeReadDigestItems("""{"items":null}"""));
    }

    private static NotificationDigestItem Digest(Guid actorId, string referenceType, string referenceId)
        => new("spot.created", $"Title {referenceId}", null, "/spots/1", actorId, referenceType, referenceId, DateTimeOffset.UtcNow);

    private static Notification Notification(Guid userId, string category, string priority) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Type = $"{category}.test",
        TemplateKey = $"{category}.test",
        Category = category,
        Priority = priority,
        Title = "Title",
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static DateTimeOffset InvokeResolveNextAttemptAt(DateTimeOffset now, NotificationPreference preference, string priority)
    {
        var method = typeof(NotificationService).GetMethod("ResolveNextAttemptAt", BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new MissingMethodException(nameof(NotificationService), "ResolveNextAttemptAt");
        return (DateTimeOffset)method.Invoke(null, [now, preference, priority])!;
    }

    private static IReadOnlyList<NotificationDigestItem> InvokeReadDigestItems(string? metadataJson)
    {
        var method = typeof(NotificationService).GetMethod("ReadDigestItems", BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new MissingMethodException(nameof(NotificationService), "ReadDigestItems");
        return (IReadOnlyList<NotificationDigestItem>)method.Invoke(null, [metadataJson])!;
    }

    private static Mock<IHubContext<NotificationHub>> QuietHubContext()
    {
        var clientProxy = new Mock<IClientProxy>();
        clientProxy.Setup(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var clients = new Mock<IHubClients>();
        clients.Setup(x => x.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        var hubContext = new Mock<IHubContext<NotificationHub>>();
        hubContext.Setup(x => x.Clients).Returns(clients.Object);
        return hubContext;
    }

    private static Mock<IHubContext<NotificationHub>> ThrowingHubContext()
    {
        var clientProxy = new Mock<IClientProxy>();
        clientProxy.Setup(x => x.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("signalr down"));
        var clients = new Mock<IHubClients>();
        clients.Setup(x => x.Group(It.IsAny<string>())).Returns(clientProxy.Object);
        var hubContext = new Mock<IHubContext<NotificationHub>>();
        hubContext.Setup(x => x.Clients).Returns(clients.Object);
        return hubContext;
    }
}
