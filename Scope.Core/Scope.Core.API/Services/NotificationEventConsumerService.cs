using System.Text.Json;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Services;

public sealed class NotificationEventConsumerService(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<NotificationEventConsumerService> logger) : BackgroundService
{
    private static readonly string[] DefaultTopics =
    [
        "spot.created",
        "trip.created",
        "spot.liked",
        "review.created",
        "trip.member.added",
        "comment.created",
        "mention.created",
    ];
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var bootstrapServers = configuration["KAFKA_BOOTSTRAP_SERVERS"];
        if (string.IsNullOrWhiteSpace(bootstrapServers))
        {
            logger.LogInformation("Notification event consumer disabled because KAFKA_BOOTSTRAP_SERVERS is not configured.");
            return;
        }

        var topics = (configuration["NOTIFICATION_EVENT_TOPICS"] ?? string.Join(',', DefaultTopics))
            .Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        await Task.Run(() => ConsumeLoop(bootstrapServers, topics, stoppingToken), stoppingToken);
    }

    private void ConsumeLoop(string bootstrapServers, string[] topics, CancellationToken stoppingToken)
    {
        using var consumer = new ConsumerBuilder<string, string>(new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = configuration["NOTIFICATION_CONSUMER_GROUP"] ?? "scope-core-notifications",
            EnableAutoCommit = false,
            AutoOffsetReset = AutoOffsetReset.Earliest,
        }).Build();

        consumer.Subscribe(topics);
        logger.LogInformation("Notification event consumer subscribed to {Topics}", string.Join(",", topics));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var result = consumer.Consume(stoppingToken);
                if (!ShouldProcessConsumedMessage(result))
                {
                    continue;
                }

                HandleMessageAsync(result.Topic, result.TopicPartitionOffset.Offset.Value, result.Message.Value, stoppingToken)
                    .GetAwaiter()
                    .GetResult();
                consumer.Commit(result);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Notification event consumer failed while processing a Kafka message");
            }
        }
    }

    private static bool ShouldProcessConsumedMessage(ConsumeResult<string, string>? result)
        => result?.Message?.Value is not null;

    private async Task HandleMessageAsync(string topic, long offset, string message, CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(message);
        var root = document.RootElement;
        var eventType = GetString(root, "eventType") ?? topic;
        var sourceEventId = GetString(root, "eventId") ?? $"{topic}:{offset}";
        var data = root.TryGetProperty("data", out var dataElement) && dataElement.ValueKind == JsonValueKind.Object
            ? dataElement
            : root;

        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var outbox = await dbContext.NotificationOutbox.FirstOrDefaultAsync(x => x.SourceEventId == sourceEventId, cancellationToken);
        if (outbox is { Status: "processed" })
        {
            return;
        }

        if (outbox is null)
        {
            outbox = new NotificationOutbox
            {
                Id = Guid.NewGuid(),
                SourceEventId = sourceEventId,
                EventType = eventType,
                PayloadJson = message,
                Status = "processing",
                Attempts = 0,
                AvailableAt = DateTimeOffset.UtcNow,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            };
            dbContext.NotificationOutbox.Add(outbox);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        try
        {
            outbox.Attempts += 1;
            outbox.Status = "processing";
            outbox.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);

            await ProcessEventAsync(dbContext, notificationService, eventType, sourceEventId, data, cancellationToken);

            outbox.Status = "processed";
            outbox.LastError = null;
            outbox.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            outbox.Status = "failed";
            outbox.LastError = ex.Message.Length <= 1000 ? ex.Message : ex.Message[..1000];
            outbox.AvailableAt = DateTimeOffset.UtcNow.AddMinutes(Math.Min(Math.Pow(2, outbox.Attempts), 360));
            outbox.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            throw;
        }
    }

    public static async Task ProcessOutboxRecordAsync(IServiceProvider serviceProvider, NotificationOutbox outbox, CancellationToken cancellationToken)
    {
        var dbContext = serviceProvider.GetRequiredService<CoreDbContext>();
        var notificationService = serviceProvider.GetRequiredService<INotificationService>();
        using var document = JsonDocument.Parse(outbox.PayloadJson);
        var root = document.RootElement;
        var data = root.TryGetProperty("data", out var dataElement) && dataElement.ValueKind == JsonValueKind.Object
            ? dataElement
            : root;

        outbox.Attempts += 1;
        outbox.Status = "processing";
        outbox.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await ProcessEventAsync(dbContext, notificationService, outbox.EventType, outbox.SourceEventId, data, cancellationToken);
            outbox.Status = "processed";
            outbox.LastError = null;
            outbox.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            outbox.Status = "failed";
            outbox.LastError = ex.Message.Length <= 1000 ? ex.Message : ex.Message[..1000];
            outbox.AvailableAt = DateTimeOffset.UtcNow.AddMinutes(Math.Min(Math.Pow(2, outbox.Attempts), 360));
            outbox.UpdatedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            throw;
        }
    }

    private static async Task ProcessEventAsync(
        CoreDbContext dbContext,
        INotificationService notificationService,
        string eventType,
        string sourceEventId,
        JsonElement data,
        CancellationToken cancellationToken)
    {
        switch (eventType)
        {
            case "spot.created":
            case "trip.created":
                await ProcessFriendDigestCandidateAsync(dbContext, notificationService, eventType, sourceEventId, data, cancellationToken);
                break;
            case "spot.liked":
                await ProcessContentReactionAsync(dbContext, notificationService, sourceEventId, data, "spot.liked", "Spot liked", cancellationToken);
                break;
            case "review.created":
                await ProcessContentReactionAsync(dbContext, notificationService, sourceEventId, data, "review.created", "New review posted", cancellationToken);
                break;
            case "trip.member.added":
                await ProcessTripMemberAddedAsync(dbContext, notificationService, sourceEventId, data, cancellationToken);
                break;
            case "comment.created":
                await ProcessCommentCreatedAsync(dbContext, notificationService, sourceEventId, data, cancellationToken);
                break;
            case "mention.created":
                await ProcessMentionCreatedAsync(dbContext, notificationService, sourceEventId, data, cancellationToken);
                break;
        }
    }

    private static async Task ProcessFriendDigestCandidateAsync(
        CoreDbContext dbContext,
        INotificationService notificationService,
        string eventType,
        string sourceEventId,
        JsonElement data,
        CancellationToken cancellationToken)
    {
        var actorId = GetGuid(data, "userId") ?? GetGuid(data, "creatorId");
        if (actorId is null || GetBool(data, "isPublic") == false)
        {
            return;
        }

        var referenceType = eventType == "spot.created" ? "spot" : "trip";
        var referenceId = GetString(data, referenceType == "spot" ? "spotId" : "tripId");
        if (string.IsNullOrWhiteSpace(referenceId))
        {
            return;
        }

        var friends = await dbContext.Friendships.AsNoTracking()
            .Where(x => x.Status == "accepted" && (x.RequesterId == actorId.Value || x.AddresseeId == actorId.Value))
            .Select(x => x.RequesterId == actorId.Value ? x.AddresseeId : x.RequesterId)
            .ToListAsync(cancellationToken);
        var title = GetString(data, "title") ?? (referenceType == "spot" ? "A friend posted a new spot" : "A friend published a trip");
        var actionUrl = referenceType == "spot" ? $"/spots/{referenceId}" : $"/trips/{referenceId}";
        var occurredAt = GetDateTimeOffset(data, "occurredAt") ?? DateTimeOffset.UtcNow;

        foreach (var friendId in friends)
        {
            await notificationService.UpsertFriendActivityDigestAsync(friendId, new NotificationDigestItem(
                eventType,
                title,
                GetString(data, "description"),
                actionUrl,
                actorId.Value,
                referenceType,
                referenceId,
                occurredAt), cancellationToken);
        }
    }

    private static async Task ProcessContentReactionAsync(
        CoreDbContext dbContext,
        INotificationService notificationService,
        string sourceEventId,
        JsonElement data,
        string type,
        string fallbackTitle,
        CancellationToken cancellationToken)
    {
        var actorId = GetGuid(data, "userId");
        var ownerId = GetGuid(data, "ownerUserId") ?? GetGuid(data, "targetOwnerUserId");
        var spotId = GetString(data, "spotId");
        if (actorId is null || ownerId is null || string.IsNullOrWhiteSpace(spotId))
        {
            return;
        }

        var actorName = await ResolveDisplayNameAsync(dbContext, actorId.Value, cancellationToken);
        var spotTitle = GetString(data, "spotTitle") ?? GetString(data, "title") ?? "your spot";
        var body = type == "spot.liked"
            ? $"{actorName} liked {spotTitle}."
            : $"{actorName} left a review on {spotTitle}.";

        await notificationService.CreateAsync(new NotificationCreateRequest(
            ownerId.Value,
            type,
            type,
            "social",
            "normal",
            fallbackTitle,
            body,
            $"/spots/{spotId}",
            actorId,
            "spot",
            spotId,
            $"{sourceEventId}:{ownerId.Value:N}",
            null,
            ToMetadata(data)), cancellationToken);
    }

    private static async Task ProcessTripMemberAddedAsync(
        CoreDbContext dbContext,
        INotificationService notificationService,
        string sourceEventId,
        JsonElement data,
        CancellationToken cancellationToken)
    {
        var tripId = GetString(data, "tripId");
        var addedUserId = GetGuid(data, "addedUserId") ?? GetGuid(data, "userId");
        var actorId = GetGuid(data, "actorUserId") ?? GetGuid(data, "ownerUserId");
        if (addedUserId is null || string.IsNullOrWhiteSpace(tripId))
        {
            return;
        }

        var actorName = actorId is { } id ? await ResolveDisplayNameAsync(dbContext, id, cancellationToken) : "A trip owner";
        var tripTitle = GetString(data, "tripTitle") ?? GetString(data, "title") ?? "a Scope trip";

        await notificationService.CreateAsync(new NotificationCreateRequest(
            addedUserId.Value,
            "trip.member.added",
            "trip.member.added",
            "trip",
            "urgent",
            "Trip invite",
            $"{actorName} added you to {tripTitle}.",
            $"/trips/{tripId}",
            actorId,
            "trip",
            tripId,
            $"{sourceEventId}:{addedUserId.Value:N}",
            null,
            ToMetadata(data)), cancellationToken);
    }

    private static async Task ProcessCommentCreatedAsync(
        CoreDbContext dbContext,
        INotificationService notificationService,
        string sourceEventId,
        JsonElement data,
        CancellationToken cancellationToken)
    {
        var actorId = GetGuid(data, "userId");
        var targetOwnerId = GetGuid(data, "targetOwnerUserId");
        var parentCommentUserId = GetGuid(data, "parentCommentUserId");
        var targetType = GetString(data, "targetType") ?? "content";
        var targetId = GetString(data, "targetId");
        var commentId = GetString(data, "commentId");
        if (actorId is null || string.IsNullOrWhiteSpace(targetId) || string.IsNullOrWhiteSpace(commentId))
        {
            return;
        }

        var actorName = await ResolveDisplayNameAsync(dbContext, actorId.Value, cancellationToken);
        var actionUrl = targetType == "trip" ? $"/trips/{targetId}?comment={commentId}" : $"/spots/{targetId}?comment={commentId}";
        var recipients = new[] { targetOwnerId, parentCommentUserId }
            .Where(x => x is not null && x.Value != actorId.Value)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        foreach (var recipientId in recipients)
        {
            await notificationService.CreateAsync(new NotificationCreateRequest(
                recipientId,
                "comment.created",
                "comment.created",
                "comment",
                "normal",
                "New comment",
                $"{actorName} commented on {GetString(data, "targetTitle") ?? "your Scope post"}.",
                actionUrl,
                actorId,
                "comment",
                commentId,
                $"{sourceEventId}:{recipientId:N}",
                null,
                ToMetadata(data)), cancellationToken);
        }
    }

    private static async Task ProcessMentionCreatedAsync(
        CoreDbContext dbContext,
        INotificationService notificationService,
        string sourceEventId,
        JsonElement data,
        CancellationToken cancellationToken)
    {
        var actorId = GetGuid(data, "userId");
        var commentId = GetString(data, "commentId");
        var targetType = GetString(data, "targetType") ?? "content";
        var targetId = GetString(data, "targetId");
        if (actorId is null || string.IsNullOrWhiteSpace(commentId) || string.IsNullOrWhiteSpace(targetId))
        {
            return;
        }

        var mentionedUserIds = GetGuidArray(data, "mentionedUserIds")
            .Where(x => x != actorId.Value)
            .Distinct()
            .ToList();
        var actorName = await ResolveDisplayNameAsync(dbContext, actorId.Value, cancellationToken);
        var actionUrl = targetType == "trip" ? $"/trips/{targetId}?comment={commentId}" : $"/spots/{targetId}?comment={commentId}";

        foreach (var mentionedUserId in mentionedUserIds)
        {
            await notificationService.CreateAsync(new NotificationCreateRequest(
                mentionedUserId,
                "mention.created",
                "mention.created",
                "mention",
                "normal",
                "You were mentioned",
                $"{actorName} mentioned you in a comment.",
                actionUrl,
                actorId,
                "comment",
                commentId,
                $"{sourceEventId}:{mentionedUserId:N}",
                null,
                ToMetadata(data)), cancellationToken);
        }
    }

    private static async Task<string> ResolveDisplayNameAsync(CoreDbContext dbContext, Guid userId, CancellationToken cancellationToken)
        => await dbContext.Users.AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => x.DisplayName)
            .FirstOrDefaultAsync(cancellationToken)
            ?? "Someone";

    private static IReadOnlyDictionary<string, object?> ToMetadata(JsonElement data)
    {
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(data.GetRawText(), JsonOptions) ?? new Dictionary<string, object?>();
        }
        catch (JsonException)
        {
            return new Dictionary<string, object?>();
        }
    }

    private static string? GetString(JsonElement element, string name)
        => element.TryGetProperty(name, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private static Guid? GetGuid(JsonElement element, string name)
        => Guid.TryParse(GetString(element, name), out var guid) ? guid : null;

    private static bool? GetBool(JsonElement element, string name)
        => element.TryGetProperty(name, out var property) && property.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? property.GetBoolean()
            : null;

    private static DateTimeOffset? GetDateTimeOffset(JsonElement element, string name)
        => DateTimeOffset.TryParse(GetString(element, name), out var value) ? value : null;

    private static IReadOnlyList<Guid> GetGuidArray(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return property.EnumerateArray()
            .Select(x => x.ValueKind == JsonValueKind.String && Guid.TryParse(x.GetString(), out var guid) ? guid : Guid.Empty)
            .Where(x => x != Guid.Empty)
            .ToList();
    }
}
