using Scope.Core.API.Infrastructure;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize]
[Route("api/core/notifications")]
public sealed class NotificationsController(CoreDbContext dbContext, INotificationService? notificationService = null) : ControllerBase
{
    private const string ActionMarkRead = "mark_read";
    private const string ActionOpen = "open";
    private const string ActionMuteCategory = "mute_category";
    private const string ActionAcceptFriendRequest = "accept_friend_request";
    private const string ActionDeclineFriendRequest = "decline_friend_request";
    private const string FriendshipStatusPending = "pending";
    private const string FriendshipStatusAccepted = "accepted";
    private const string FriendAcceptedNotificationType = "friend.accepted";

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? category = null,
        [FromQuery] bool? unread = null,
        CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        var pagination = Pagination.Normalize(page, pageSize, defaultPageSize: 20, maxPageSize: 100);
        var now = DateTimeOffset.UtcNow;
        var query = dbContext.Notifications
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.ArchivedAt == null && (x.ExpiresAt == null || x.ExpiresAt > now));
        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalizedCategory = category.Trim();
            query = query.Where(x => x.Category == normalizedCategory);
        }
        if (unread is not null)
        {
            query = query.Where(x => x.IsRead != unread.Value);
        }

        query = query.OrderByDescending(x => x.CreatedAt);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip(pagination.Offset).Take(pagination.PageSize).ToListAsync(cancellationToken);
        return Ok(new ApiResponse<object>(items, pagination.ToMetadata(total)));
    }

    /// <summary>
    /// Count of notifications the caller hasn't marked as read yet. Used by
    /// the frontend navbar badge; cheap covered-index count.
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var now = DateTimeOffset.UtcNow;
        var count = await dbContext.Notifications
            .AsNoTracking()
            .CountAsync(
                x => x.UserId == userId
                    && !x.IsRead
                    && x.ArchivedAt == null
                    && (x.ExpiresAt == null || x.ExpiresAt > now),
                cancellationToken);
        return Ok(new ApiResponse<object>(new { count }));
    }

    /// <summary>
    /// Mark a single notification as read. No-op if already read. Returns
    /// 404 for missing or cross-user notification ids so we never leak that
    /// a notification exists belonging to someone else.
    /// </summary>
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (notification is null || notification.UserId != userId)
        {
            return NotFound(new ApiResponse<object>(new { message = "Notification not found" }));
        }
        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return Ok(new ApiResponse<object>(notification));
    }

    /// <summary>
    /// Mark all of the caller's notifications as read. Returns the count
    /// updated so the client can reconcile its unread badge immediately.
    /// </summary>
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var unread = await dbContext.Notifications
            .Where(x => x.UserId == userId && !x.IsRead)
            .ToListAsync(cancellationToken);
        foreach (var row in unread)
        {
            row.IsRead = true;
            row.ReadAt = DateTimeOffset.UtcNow;
        }
        if (unread.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return Ok(new ApiResponse<object>(new { updated = unread.Count }));
    }

    [HttpGet("preferences")]
    public async Task<IActionResult> Preferences(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var rows = await dbContext.NotificationPreferences
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.Category)
            .ToListAsync(cancellationToken);
        return Ok(new ApiResponse<object>(rows));
    }

    [HttpPut("preferences")]
    public async Task<IActionResult> UpdatePreference([FromBody] NotificationPreferenceRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var category = TextNormalization.Required(request.Category, "general", 40);
        var cadence = TextNormalization.Required(request.DigestCadence, "daily", 20);
        if (request.QuietHoursStartMinutes is < 0 or > 1439 || request.QuietHoursEndMinutes is < 0 or > 1439)
        {
            return BadRequest(new ApiResponse<object>(new { message = "Quiet hour minutes must be between 0 and 1439." }));
        }

        var preference = await dbContext.NotificationPreferences.FirstOrDefaultAsync(
            x => x.UserId == userId && x.Category == category,
            cancellationToken);
        var now = DateTimeOffset.UtcNow;
        if (preference is null)
        {
            preference = new NotificationPreference
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Category = category,
                CreatedAt = now,
            };
            dbContext.NotificationPreferences.Add(preference);
        }

        preference.InAppEnabled = request.InAppEnabled;
        preference.PushEnabled = request.PushEnabled;
        preference.EmailEnabled = request.EmailEnabled;
        preference.DigestCadence = cadence;
        preference.QuietHoursStartMinutes = request.QuietHoursStartMinutes;
        preference.QuietHoursEndMinutes = request.QuietHoursEndMinutes;
        preference.TimeZoneId = TextNormalization.Required(request.TimeZoneId, "UTC", 80);
        preference.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(preference));
    }

    [HttpPost("push-subscriptions")]
    public async Task<IActionResult> SavePushSubscription([FromBody] PushSubscriptionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var endpoint = TextNormalization.Required(request.Endpoint, string.Empty, 1200);
        if (!await PushEndpointValidator.IsAllowedAsync(endpoint, cancellationToken))
        {
            return BadRequest(new ApiResponse<object>(new { message = PushEndpointValidator.InvalidEndpointMessage }));
        }

        var subscription = await dbContext.PushSubscriptions.FirstOrDefaultAsync(x => x.Endpoint == endpoint, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        if (subscription is null)
        {
            subscription = new PushSubscription
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Endpoint = endpoint,
                CreatedAt = now,
            };
            dbContext.PushSubscriptions.Add(subscription);
        }
        else if (subscription.UserId != userId)
        {
            return Forbid();
        }

        subscription.P256dh = TextNormalization.Required(request.P256dh, string.Empty, 256);
        subscription.Auth = TextNormalization.Required(request.Auth, string.Empty, 256);
        subscription.UserAgent = TextNormalization.Optional(request.UserAgent, 300);
        subscription.IsEnabled = true;
        subscription.RevokedAt = null;
        subscription.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(subscription));
    }

    [HttpDelete("push-subscriptions/{id:guid}")]
    public async Task<IActionResult> DeletePushSubscription(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var subscription = await dbContext.PushSubscriptions.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken);
        if (subscription is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "Push subscription not found" }));
        }

        subscription.IsEnabled = false;
        subscription.RevokedAt = DateTimeOffset.UtcNow;
        subscription.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/actions")]
    public async Task<IActionResult> PerformAction(Guid id, [FromBody] NotificationActionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (notification is null || notification.UserId != userId)
        {
            return NotFound(new ApiResponse<object>(new { message = "Notification not found" }));
        }

        var action = (request.Action ?? string.Empty).Trim().ToLowerInvariant();
        return action switch
        {
            ActionMarkRead or ActionOpen => await MarkRead(id, cancellationToken),
            ActionMuteCategory => await MuteCategoryAsync(notification, cancellationToken),
            ActionAcceptFriendRequest => await AcceptFriendRequestAsync(notification, userId, cancellationToken),
            ActionDeclineFriendRequest => await DeclineFriendRequestAsync(notification, userId, cancellationToken),
            _ => BadRequest(new ApiResponse<object>(new { message = "Unsupported notification action" })),
        };
    }

    /// <summary>
    /// Delete one notification owned by the caller. Missing and cross-user ids
    /// both return 404 so notification existence is not leaked.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (notification is null || notification.UserId != userId)
        {
            return NotFound(new ApiResponse<object>(new { message = "Notification not found" }));
        }

        var deliveries = await dbContext.NotificationDeliveries
            .Where(x => x.NotificationId == notification.Id)
            .ToListAsync(cancellationToken);
        dbContext.NotificationDeliveries.RemoveRange(deliveries);
        dbContext.Notifications.Remove(notification);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<IActionResult> MuteCategoryAsync(Notification notification, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var preference = await dbContext.NotificationPreferences.FirstOrDefaultAsync(
            x => x.UserId == notification.UserId && x.Category == notification.Category,
            cancellationToken);

        if (preference is null)
        {
            preference = new NotificationPreference
            {
                Id = Guid.NewGuid(),
                UserId = notification.UserId,
                Category = notification.Category,
                CreatedAt = now,
                TimeZoneId = "UTC",
                DigestCadence = "daily",
            };
            dbContext.NotificationPreferences.Add(preference);
        }

        preference.InAppEnabled = false;
        preference.PushEnabled = false;
        preference.EmailEnabled = false;
        preference.UpdatedAt = now;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(preference));
    }

    private async Task<IActionResult> AcceptFriendRequestAsync(Notification notification, Guid userId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(notification.ReferenceId, out var friendshipId))
        {
            return BadRequest(new ApiResponse<object>(new { message = "Notification is not linked to a friend request" }));
        }

        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == friendshipId, cancellationToken);
        if (friendship is null
            || friendship.AddresseeId != userId
            || (friendship.Status != FriendshipStatusPending && friendship.Status != FriendshipStatusAccepted))
        {
            return NotFound(new ApiResponse<object>(new { message = "Friend request not found" }));
        }

        var wasPending = friendship.Status == FriendshipStatusPending;
        if (wasPending)
        {
            friendship.Status = FriendshipStatusAccepted;
        }
        notification.IsRead = true;
        notification.ReadAt ??= DateTimeOffset.UtcNow;
        notification.ArchivedAt ??= DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        if (wasPending && notificationService is not null)
        {
            await notificationService.CreateAsync(new NotificationCreateRequest(
                friendship.RequesterId,
                FriendAcceptedNotificationType,
                FriendAcceptedNotificationType,
                "friend",
                "normal",
                "Friend request accepted",
                "Your Scope friend request was accepted.",
                $"/profile/{friendship.AddresseeId}",
                friendship.AddresseeId,
                "friendship",
                friendship.Id.ToString(),
                $"{FriendAcceptedNotificationType}:{friendship.Id:N}",
                null,
                null,
                DateTimeOffset.UtcNow), cancellationToken);
        }

        return Ok(new ApiResponse<object>(new { friendship.Id, friendship.Status }));
    }

    private async Task<IActionResult> DeclineFriendRequestAsync(Notification notification, Guid userId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(notification.ReferenceId, out var friendshipId))
        {
            return BadRequest(new ApiResponse<object>(new { message = "Notification is not linked to a friend request" }));
        }

        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == friendshipId, cancellationToken);
        if (friendship is null || friendship.AddresseeId != userId || friendship.Status != FriendshipStatusPending)
        {
            return NotFound(new ApiResponse<object>(new { message = "Friend request not found" }));
        }

        dbContext.Friendships.Remove(friendship);
        notification.IsRead = true;
        notification.ReadAt ??= DateTimeOffset.UtcNow;
        notification.ArchivedAt ??= DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

}
