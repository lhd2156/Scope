using System.Text.Json;
using Scope.Core.API.Hubs;
using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Services;

public sealed class NotificationService(
    CoreDbContext dbContext,
    IHubContext<NotificationHub> hubContext,
    ILogger<NotificationService> logger) : INotificationService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> EmailCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "account",
        "security",
        "trip",
        "digest",
    };
    private static readonly HashSet<string> PushCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "account",
        "security",
        "trip",
        "friend",
        "social",
        "comment",
        "mention",
    };

    public async Task<Notification?> CreateAsync(NotificationCreateRequest request, CancellationToken cancellationToken = default)
    {
        if (request.UserId == Guid.Empty || string.IsNullOrWhiteSpace(request.Type))
        {
            return null;
        }

        if (request.ActorUserId == request.UserId)
        {
            return null;
        }

        if (request.ActorUserId is { } actorId && await IsBlockedEitherWayAsync(request.UserId, actorId, cancellationToken))
        {
            return null;
        }

        if (!await dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == request.UserId && x.IsActive, cancellationToken))
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(request.SourceEventId))
        {
            var existing = await dbContext.Notifications
                .FirstOrDefaultAsync(x => x.UserId == request.UserId && x.SourceEventId == request.SourceEventId, cancellationToken);
            if (existing is not null)
            {
                return existing;
            }
        }

        var now = request.CreatedAt ?? DateTimeOffset.UtcNow;
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Type = TextNormalization.Required(request.Type, "general", 80),
            TemplateKey = TextNormalization.Required(request.TemplateKey, request.Type, 120),
            TemplateVersion = 1,
            Category = TextNormalization.Required(request.Category, "general", 40),
            Priority = TextNormalization.Required(request.Priority, "normal", 20),
            Title = TextNormalization.Required(request.Title, "Scope update", 200),
            Body = TextNormalization.Optional(request.Body, 1000),
            ActionUrl = TextNormalization.Optional(request.ActionUrl, 500),
            ActorUserId = request.ActorUserId,
            ReferenceType = TextNormalization.Optional(request.ReferenceType, 60),
            ReferenceId = TextNormalization.Optional(request.ReferenceId, 120),
            SourceEventId = TextNormalization.Optional(request.SourceEventId, 160),
            GroupKey = TextNormalization.Optional(request.GroupKey, 180),
            MetadataJson = request.Metadata is null ? null : JsonSerializer.Serialize(request.Metadata, JsonOptions),
            IsRead = false,
            CreatedAt = now,
            ExpiresAt = request.ExpiresAt ?? now.AddDays(90),
        };

        dbContext.Notifications.Add(notification);
        await dbContext.SaveChangesAsync(cancellationToken);
        await QueueDeliveryAttemptsAsync(notification, cancellationToken);
        await PublishRealtimeAsync(notification, cancellationToken);
        return notification;
    }

    public async Task<Notification?> UpsertFriendActivityDigestAsync(
        Guid recipientUserId,
        NotificationDigestItem item,
        CancellationToken cancellationToken = default)
    {
        if (recipientUserId == Guid.Empty || item.ActorUserId == Guid.Empty || recipientUserId == item.ActorUserId)
        {
            return null;
        }

        if (await IsBlockedEitherWayAsync(recipientUserId, item.ActorUserId, cancellationToken))
        {
            return null;
        }

        var digestDay = item.OccurredAt.UtcDateTime.Date;
        var groupKey = $"friend.activity:{recipientUserId:N}:{digestDay:yyyyMMdd}";
        var existing = await dbContext.Notifications.FirstOrDefaultAsync(x => x.UserId == recipientUserId && x.GroupKey == groupKey, cancellationToken);
        var items = ReadDigestItems(existing?.MetadataJson);
        if (items.Any(x => x.ReferenceType == item.ReferenceType && x.ReferenceId == item.ReferenceId))
        {
            return existing;
        }

        items.Add(item);
        items = items
            .OrderByDescending(x => x.OccurredAt)
            .Take(10)
            .ToList();

        var metadata = new Dictionary<string, object?>
        {
            ["items"] = items,
            ["hiddenCount"] = Math.Max(0, ReadDigestItems(existing?.MetadataJson).Count + 1 - items.Count),
        };

        var title = items.Count == 1 ? "Friend activity today" : $"{items.Count} friend updates today";
        var body = items.Count == 1
            ? items[0].Title
            : string.Join("; ", items.Take(3).Select(x => x.Title));

        if (existing is null)
        {
            return await CreateAsync(new NotificationCreateRequest(
                recipientUserId,
                "friend.activity.digest",
                "friend.activity.digest.daily",
                "digest",
                "low",
                title,
                body,
                "/notifications",
                item.ActorUserId,
                "digest",
                digestDay.ToString("yyyy-MM-dd"),
                groupKey,
                groupKey,
                metadata,
                item.OccurredAt,
                DateTimeOffset.UtcNow.AddDays(90)), cancellationToken);
        }

        existing.Title = title;
        existing.Body = body;
        existing.MetadataJson = JsonSerializer.Serialize(metadata, JsonOptions);
        existing.IsRead = false;
        existing.ReadAt = null;
        existing.CreatedAt = DateTimeOffset.UtcNow;
        existing.ExpiresAt = DateTimeOffset.UtcNow.AddDays(90);
        await dbContext.SaveChangesAsync(cancellationToken);
        await QueueDeliveryAttemptsAsync(existing, cancellationToken);
        await PublishRealtimeAsync(existing, cancellationToken);
        return existing;
    }

    public async Task QueueDeliveryAttemptsAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        var preference = await ResolvePreferenceAsync(notification.UserId, notification.Category, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var channels = ResolveExternalChannels(notification, preference);

        foreach (var channel in channels)
        {
            var exists = await dbContext.NotificationDeliveries
                .AnyAsync(x => x.NotificationId == notification.Id && x.Channel == channel, cancellationToken);
            if (exists)
            {
                continue;
            }

            dbContext.NotificationDeliveries.Add(new NotificationDelivery
            {
                Id = Guid.NewGuid(),
                NotificationId = notification.Id,
                UserId = notification.UserId,
                Channel = channel,
                Status = "pending",
                Attempts = 0,
                NextAttemptAt = ResolveNextAttemptAt(now, preference, notification.Priority),
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<NotificationPreference> ResolvePreferenceAsync(Guid userId, string category, CancellationToken cancellationToken)
    {
        var normalizedCategory = TextNormalization.Required(category, "general", 40);
        var preference = await dbContext.NotificationPreferences
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Category == normalizedCategory, cancellationToken);

        if (preference is not null)
        {
            return preference;
        }

        var now = DateTimeOffset.UtcNow;
        return new NotificationPreference
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Category = normalizedCategory,
            InAppEnabled = true,
            PushEnabled = true,
            EmailEnabled = EmailCategories.Contains(normalizedCategory),
            DigestCadence = "daily",
            TimeZoneId = "UTC",
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    private static IReadOnlyList<string> ResolveExternalChannels(Notification notification, NotificationPreference preference)
    {
        var channels = new List<string>();
        if (preference.PushEnabled && PushCategories.Contains(notification.Category))
        {
            channels.Add("push");
        }

        if (preference.EmailEnabled && EmailCategories.Contains(notification.Category))
        {
            channels.Add("email");
        }

        return channels;
    }

    private static DateTimeOffset ResolveNextAttemptAt(DateTimeOffset now, NotificationPreference preference, string priority)
    {
        if (string.Equals(priority, "urgent", StringComparison.OrdinalIgnoreCase) ||
            preference.QuietHoursStartMinutes is null ||
            preference.QuietHoursEndMinutes is null)
        {
            return now;
        }

        var minuteOfDay = (now.UtcDateTime.Hour * 60) + now.UtcDateTime.Minute;
        var start = preference.QuietHoursStartMinutes.Value;
        var end = preference.QuietHoursEndMinutes.Value;
        var inQuietHours = start < end
            ? minuteOfDay >= start && minuteOfDay < end
            : minuteOfDay >= start || minuteOfDay < end;

        if (!inQuietHours)
        {
            return now;
        }

        var minutesUntilEnd = (end - minuteOfDay + 1440) % 1440;
        return now.AddMinutes(minutesUntilEnd == 0 ? 1 : minutesUntilEnd);
    }

    private async Task<bool> IsBlockedEitherWayAsync(Guid userId, Guid actorId, CancellationToken cancellationToken)
        => await dbContext.UserBlocks.AsNoTracking().AnyAsync(
            x => (x.BlockerId == userId && x.BlockedId == actorId) || (x.BlockerId == actorId && x.BlockedId == userId),
            cancellationToken);

    private async Task PublishRealtimeAsync(Notification notification, CancellationToken cancellationToken)
    {
        try
        {
            await hubContext.Clients.Group($"user:{notification.UserId}").SendAsync("NotificationReceived", notification, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to publish notification {NotificationId} to SignalR", notification.Id);
        }
    }

    private static List<NotificationDigestItem> ReadDigestItems(string? metadataJson)
    {
        if (string.IsNullOrWhiteSpace(metadataJson))
        {
            return [];
        }

        try
        {
            using var document = JsonDocument.Parse(metadataJson);
            if (!document.RootElement.TryGetProperty("items", out var itemsElement) || itemsElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var items = JsonSerializer.Deserialize<List<NotificationDigestItem>>(itemsElement.GetRawText(), JsonOptions);
            return items ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

}
