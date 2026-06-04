namespace Scope.Core.Domain.Interfaces;

public interface IKafkaProducerService
{
    Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default);
}

public interface INotificationService
{
    Task<Entities.Notification?> CreateAsync(Models.NotificationCreateRequest request, CancellationToken cancellationToken = default);

    Task<Entities.Notification?> UpsertFriendActivityDigestAsync(
        Guid recipientUserId,
        Models.NotificationDigestItem item,
        CancellationToken cancellationToken = default);

    Task QueueDeliveryAttemptsAsync(Entities.Notification notification, CancellationToken cancellationToken = default);
}
