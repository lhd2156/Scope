using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Entities;
using Scope.Core.Infrastructure.Data;
using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WebPush;
using WebPushSubscription = WebPush.PushSubscription;

namespace Scope.Core.API.Services;

public interface INotificationChannelSender
{
    string Channel { get; }
    Task<NotificationChannelSendResult> SendAsync(NotificationDelivery delivery, Notification notification, CancellationToken cancellationToken);
}

public sealed record NotificationChannelSendResult(bool Success, string? ProviderMessageId = null, string? ErrorCode = null, string? ErrorMessage = null);

public sealed class WebPushNotificationSender(
    CoreDbContext dbContext,
    IConfiguration configuration,
    ILogger<WebPushNotificationSender> logger) : INotificationChannelSender
{
    public string Channel => "push";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<NotificationChannelSendResult> SendAsync(NotificationDelivery delivery, Notification notification, CancellationToken cancellationToken)
    {
        var publicKey = configuration["WEB_PUSH_PUBLIC_KEY"];
        var privateKey = configuration["WEB_PUSH_PRIVATE_KEY"];
        var subject = configuration["WEB_PUSH_SUBJECT"] ?? configuration["CORE_FRONTEND_ORIGIN"] ?? "mailto:ops@scope.local";
        if (string.IsNullOrWhiteSpace(publicKey) || string.IsNullOrWhiteSpace(privateKey))
        {
            return new NotificationChannelSendResult(false, null, "web_push_not_configured", "WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY must be configured.");
        }

        var subscriptions = await dbContext.PushSubscriptions
            .Where(x => x.UserId == notification.UserId && x.IsEnabled && x.RevokedAt == null)
            .ToListAsync(cancellationToken);
        if (subscriptions.Count == 0)
        {
            return new NotificationChannelSendResult(false, null, "push_subscription_missing", "User has no active push subscription.");
        }

        using var client = new WebPushClient();
        var vapidDetails = new VapidDetails(subject, publicKey, privateKey);
        var payload = JsonSerializer.Serialize(new
        {
            notificationId = notification.Id,
            notification.Type,
            notification.Category,
            notification.Priority,
            notification.Title,
            body = notification.Body,
            notification.ActionUrl,
            notification.ReferenceType,
            notification.ReferenceId,
        }, JsonOptions);
        var sentCount = 0;
        string? lastError = null;

        foreach (var subscription in subscriptions)
        {
            try
            {
                if (!await PushEndpointValidator.IsAllowedAsync(subscription.Endpoint, cancellationToken))
                {
                    subscription.IsEnabled = false;
                    subscription.RevokedAt = DateTimeOffset.UtcNow;
                    subscription.UpdatedAt = DateTimeOffset.UtcNow;
                    lastError = PushEndpointValidator.InvalidEndpointMessage;
                    continue;
                }

                await client.SendNotificationAsync(
                    new WebPushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth),
                    payload,
                    vapidDetails,
                    cancellationToken);
                subscription.LastUsedAt = DateTimeOffset.UtcNow;
                subscription.UpdatedAt = DateTimeOffset.UtcNow;
                sentCount += 1;
            }
            catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
            {
                subscription.IsEnabled = false;
                subscription.RevokedAt = DateTimeOffset.UtcNow;
                subscription.UpdatedAt = DateTimeOffset.UtcNow;
                lastError = ex.Message;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Web push send failed notification={NotificationId} subscription={SubscriptionId}", notification.Id, subscription.Id);
                lastError = ex.Message;
            }
        }

        return sentCount > 0
            ? new NotificationChannelSendResult(true, $"webpush:{notification.Id:N}:{sentCount}")
            : new NotificationChannelSendResult(false, null, "web_push_failed", lastError ?? "No push subscriptions accepted the notification.");
    }
}

public sealed class NoopEmailNotificationSender(ILogger<NoopEmailNotificationSender> logger) : INotificationChannelSender
{
    public string Channel => "email";

    public Task<NotificationChannelSendResult> SendAsync(NotificationDelivery delivery, Notification notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("No-op email delivery notification={NotificationId} user={UserId}", notification.Id, notification.UserId);
        return Task.FromResult(new NotificationChannelSendResult(true, $"noop-email:{notification.Id:N}"));
    }
}

public sealed class NotificationDeliveryDispatcher(
    IServiceScopeFactory scopeFactory,
    ILogger<NotificationDeliveryDispatcher> logger) : BackgroundService
{
    private const int BatchSize = 50;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan MaxBackoff = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Notification delivery dispatcher batch failed");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task DispatchBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        var senders = scope.ServiceProvider.GetServices<INotificationChannelSender>()
            .ToDictionary(x => x.Channel, StringComparer.OrdinalIgnoreCase);
        var now = DateTimeOffset.UtcNow;
        var deliveries = await dbContext.NotificationDeliveries
            .Include(x => x.Notification)
            .Where(x => x.Status == "pending" && x.NextAttemptAt <= now)
            .OrderBy(x => x.NextAttemptAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var delivery in deliveries)
        {
            if (!senders.TryGetValue(delivery.Channel, out var sender))
            {
                delivery.Attempts += 1;
                MarkFailed(delivery, "sender_missing", $"No sender registered for {delivery.Channel}");
                continue;
            }

            if (delivery.Channel == "push")
            {
                var hasPushSubscription = await dbContext.PushSubscriptions.AsNoTracking().AnyAsync(
                    x => x.UserId == delivery.UserId && x.IsEnabled && x.RevokedAt == null,
                    cancellationToken);
                if (!hasPushSubscription)
                {
                    delivery.Status = "suppressed";
                    delivery.ErrorCode = "push_subscription_missing";
                    delivery.LastError = "User has no active push subscription.";
                    delivery.UpdatedAt = DateTimeOffset.UtcNow;
                    continue;
                }
            }

            try
            {
                var result = await sender.SendAsync(delivery, delivery.Notification, cancellationToken);
                delivery.Attempts += 1;
                delivery.UpdatedAt = DateTimeOffset.UtcNow;
                if (result.Success)
                {
                    delivery.Status = "sent";
                    delivery.ProviderMessageId = result.ProviderMessageId;
                    delivery.ErrorCode = null;
                    delivery.LastError = null;
                }
                else
                {
                    MarkFailed(delivery, result.ErrorCode ?? "provider_error", result.ErrorMessage ?? "Provider rejected the delivery.");
                }
            }
            catch (Exception ex)
            {
                delivery.Attempts += 1;
                MarkFailed(delivery, "dispatch_exception", ex.Message);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static void MarkFailed(NotificationDelivery delivery, string errorCode, string errorMessage)
    {
        delivery.ErrorCode = errorCode;
        delivery.LastError = errorMessage.Length <= 1000 ? errorMessage : errorMessage[..1000];
        delivery.UpdatedAt = DateTimeOffset.UtcNow;

        if (delivery.Attempts >= 8)
        {
            delivery.Status = "failed";
            return;
        }

        delivery.Status = "pending";
        var backoffMinutes = Math.Min(Math.Pow(2, Math.Max(0, delivery.Attempts)), MaxBackoff.TotalMinutes);
        delivery.NextAttemptAt = DateTimeOffset.UtcNow.AddMinutes(backoffMinutes);
    }
}
