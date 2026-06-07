using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class NotificationsControllerMoreTests
{
    [Fact]
    public async Task ListUnreadCountAndReadActions_FilterClampAndUpdateOwnedRows()
    {
        var userId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        var keep = AddNotification(dbContext, userId, "social", isRead: false, createdAt: DateTimeOffset.UtcNow.AddMinutes(-1));
        AddNotification(dbContext, userId, "social", isRead: true);
        AddNotification(dbContext, userId, "system", isRead: false);
        AddNotification(dbContext, userId, "social", isRead: false, archivedAt: DateTimeOffset.UtcNow);
        AddNotification(dbContext, userId, "social", isRead: false, expiresAt: DateTimeOffset.UtcNow.AddMinutes(-1));
        AddNotification(dbContext, otherId, "social", isRead: false);
        await dbContext.SaveChangesAsync();

        var controller = new NotificationsController(dbContext).WithUser(userId);

        var list = await controller.List(0, 500, " social ", true, CancellationToken.None);
        var response = TestData.Response(Assert.IsType<OkObjectResult>(list));
        var items = Assert.IsAssignableFrom<IEnumerable<Notification>>(response.Data).ToList();
        Assert.Equal(keep.Id, Assert.Single(items).Id);
        Assert.Equal(100, TestData.Prop<int>(response.Meta!, "pageSize"));

        var unread = await controller.UnreadCount(CancellationToken.None);
        Assert.Equal(2, TestData.Prop<int>(TestData.Response(Assert.IsType<OkObjectResult>(unread)).Data, "count"));

        var missing = await controller.MarkRead(Guid.NewGuid(), CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(missing);

        var marked = await controller.MarkRead(keep.Id, CancellationToken.None);
        Assert.IsType<OkObjectResult>(marked);
        Assert.True((await dbContext.Notifications.FindAsync([keep.Id], CancellationToken.None))!.IsRead);

        var all = await controller.MarkAllRead(CancellationToken.None);
        Assert.Equal(3, TestData.Prop<int>(TestData.Response(Assert.IsType<OkObjectResult>(all)).Data, "updated"));
    }

    [Fact]
    public async Task PreferencesAndPushSubscriptions_UpsertValidateRevokeAndProtectOwnership()
    {
        var userId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        var controller = new NotificationsController(dbContext).WithUser(userId);

        var badPreference = await controller.UpdatePreference(
            new NotificationPreferenceRequest("security", true, true, true, "instant", -1, null, "UTC"),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badPreference);

        var savedPreference = await controller.UpdatePreference(
            new NotificationPreferenceRequest(" security-alerts ", true, false, true, " weekly ", 60, 120, " America/Chicago "),
            CancellationToken.None);
        var preference = Assert.IsType<NotificationPreference>(TestData.Response(Assert.IsType<OkObjectResult>(savedPreference)).Data);
        Assert.Equal("security-alerts", preference.Category);
        Assert.Equal("weekly", preference.DigestCadence);

        var preferences = await controller.Preferences(CancellationToken.None);
        Assert.Single(Assert.IsAssignableFrom<IEnumerable<NotificationPreference>>(TestData.Response(Assert.IsType<OkObjectResult>(preferences)).Data));

        const string Endpoint = "https://8.8.8.8/push/endpoint-1";
        var created = await controller.SavePushSubscription(
            new PushSubscriptionRequest($" {Endpoint} ", "p256", "auth", "agent"),
            CancellationToken.None);
        var subscription = Assert.IsType<PushSubscription>(TestData.Response(Assert.IsType<OkObjectResult>(created)).Data);
        Assert.Equal(Endpoint, subscription.Endpoint);

        var updated = await controller.SavePushSubscription(
            new PushSubscriptionRequest(Endpoint, "new-p256", "new-auth", null),
            CancellationToken.None);
        Assert.Equal("new-p256", Assert.IsType<PushSubscription>(TestData.Response(Assert.IsType<OkObjectResult>(updated)).Data).P256dh);

        var blockedEndpoint = await controller.SavePushSubscription(
            new PushSubscriptionRequest("http://127.0.0.1/private", "p", "a", null),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(blockedEndpoint);

        dbContext.PushSubscriptions.Add(new PushSubscription
        {
            Id = Guid.NewGuid(),
            UserId = otherId,
            Endpoint = "https://9.9.9.9/push/foreign",
            P256dh = "x",
            Auth = "y",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var forbidden = await controller.SavePushSubscription(
            new PushSubscriptionRequest("https://9.9.9.9/push/foreign", "p", "a", null),
            CancellationToken.None);
        Assert.IsType<ForbidResult>(forbidden);

        Assert.IsType<NotFoundObjectResult>(await controller.DeletePushSubscription(Guid.NewGuid(), CancellationToken.None));
        Assert.IsType<NoContentResult>(await controller.DeletePushSubscription(subscription.Id, CancellationToken.None));
        Assert.False((await dbContext.PushSubscriptions.FindAsync([subscription.Id], CancellationToken.None))!.IsEnabled);
    }

    [Fact]
    public async Task PerformAction_CoversMuteAcceptDeclineAndUnsupportedBranches()
    {
        var requester = Guid.NewGuid();
        var addressee = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        var notificationService = new CapturingNotificationService();
        var controller = new NotificationsController(dbContext, notificationService).WithUser(addressee);

        var mute = AddNotification(dbContext, addressee, "social", isRead: false);
        var acceptFriendship = new Friendship { Id = Guid.NewGuid(), RequesterId = requester, AddresseeId = addressee, Status = "pending", CreatedAt = DateTimeOffset.UtcNow };
        var acceptNotice = AddNotification(dbContext, addressee, "friend", isRead: false, referenceId: acceptFriendship.Id.ToString());
        var declineFriendship = new Friendship { Id = Guid.NewGuid(), RequesterId = requester, AddresseeId = addressee, Status = "pending", CreatedAt = DateTimeOffset.UtcNow };
        var declineNotice = AddNotification(dbContext, addressee, "friend", isRead: false, referenceId: declineFriendship.Id.ToString());
        var invalidNotice = AddNotification(dbContext, addressee, "friend", isRead: false, referenceId: "not-a-guid");
        dbContext.Friendships.AddRange(acceptFriendship, declineFriendship);
        await dbContext.SaveChangesAsync();

        Assert.IsType<BadRequestObjectResult>(await controller.PerformAction(mute.Id, new NotificationActionRequest("nope"), CancellationToken.None));

        var muted = await controller.PerformAction(mute.Id, new NotificationActionRequest("mute_category"), CancellationToken.None);
        var preference = Assert.IsType<NotificationPreference>(TestData.Response(Assert.IsType<OkObjectResult>(muted)).Data);
        Assert.False(preference.PushEnabled);
        Assert.False(preference.EmailEnabled);

        var accepted = await controller.PerformAction(acceptNotice.Id, new NotificationActionRequest("accept_friend_request"), CancellationToken.None);
        Assert.Equal("accepted", TestData.Prop<string>(TestData.Response(Assert.IsType<OkObjectResult>(accepted)).Data, "Status"));
        Assert.True(acceptNotice.IsRead);
        Assert.NotNull(acceptNotice.ArchivedAt);
        Assert.Single(notificationService.Created);

        var acceptedAgain = await controller.PerformAction(acceptNotice.Id, new NotificationActionRequest("accept_friend_request"), CancellationToken.None);
        Assert.Equal("accepted", TestData.Prop<string>(TestData.Response(Assert.IsType<OkObjectResult>(acceptedAgain)).Data, "Status"));
        Assert.Single(notificationService.Created);

        var declined = await controller.PerformAction(declineNotice.Id, new NotificationActionRequest("decline_friend_request"), CancellationToken.None);
        Assert.IsType<NoContentResult>(declined);
        Assert.Null(await dbContext.Friendships.FindAsync([declineFriendship.Id], CancellationToken.None));
        Assert.NotNull(declineNotice.ArchivedAt);

        Assert.IsType<BadRequestObjectResult>(await controller.PerformAction(invalidNotice.Id, new NotificationActionRequest("accept_friend_request"), CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.PerformAction(Guid.NewGuid(), new NotificationActionRequest("open"), CancellationToken.None));
    }

    [Fact]
    public async Task PerformActionAndDelete_CoverOpenDeclineMissingAndInvalidReferences()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        var controller = new NotificationsController(dbContext).WithUser(userId);
        var openNotice = AddNotification(dbContext, userId, "system", isRead: false);
        var invalidDecline = AddNotification(dbContext, userId, "friend", isRead: false, referenceId: "not-a-guid");
        var missingFriendshipDecline = AddNotification(dbContext, userId, "friend", isRead: false, referenceId: Guid.NewGuid().ToString());
        await dbContext.SaveChangesAsync();

        var opened = await controller.PerformAction(openNotice.Id, new NotificationActionRequest("open"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(opened);
        Assert.True(openNotice.IsRead);

        Assert.IsType<BadRequestObjectResult>(await controller.PerformAction(invalidDecline.Id, new NotificationActionRequest("decline_friend_request"), CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.PerformAction(missingFriendshipDecline.Id, new NotificationActionRequest("decline_friend_request"), CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.Delete(Guid.NewGuid(), CancellationToken.None));
    }

    private static Notification AddNotification(
        Scope.Core.Infrastructure.Data.CoreDbContext dbContext,
        Guid userId,
        string category,
        bool isRead,
        DateTimeOffset? createdAt = null,
        DateTimeOffset? archivedAt = null,
        DateTimeOffset? expiresAt = null,
        string? referenceId = null)
    {
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = category,
            TemplateKey = category,
            Category = category,
            Priority = "normal",
            Title = category,
            IsRead = isRead,
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow,
            ArchivedAt = archivedAt,
            ExpiresAt = expiresAt,
            ReferenceId = referenceId,
        };
        dbContext.Notifications.Add(notification);
        return notification;
    }
}
