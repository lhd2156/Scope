using System.Text.Json;
using Atlas.Core.Domain.Constants;

namespace Atlas.Core.Domain.Models;

public sealed record KafkaEventEnvelope<T>(Guid EventId, string EventType, DateTime Timestamp, string Source, T Data);

public sealed record UserRegisteredEventData(Guid UserId, string Username, string Email);
public sealed record UserUpdatedEventData(Guid UserId, string Username, string DisplayName, string? Bio, string? AvatarUrl);
public sealed record FriendAcceptedEventData(Guid FriendshipId, Guid RequesterId, Guid AddresseeId);
public sealed record LiveLocationUpdatedEventData(Guid TripId, Guid UserId, double Latitude, double Longitude);

public static class KafkaEventSerializer
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static KafkaEventEnvelope<T> CreateEnvelope<T>(string eventType, T data, Guid? eventId = null, DateTime? timestamp = null)
        => new(
            eventId ?? Guid.NewGuid(),
            eventType,
            (timestamp ?? DateTime.UtcNow).ToUniversalTime(),
            CoreDefaults.KafkaEventSource,
            data);

    public static string Serialize<T>(KafkaEventEnvelope<T> envelope)
        => JsonSerializer.Serialize(envelope, JsonOptions);

    public static string Serialize<T>(string eventType, T data, Guid? eventId = null, DateTime? timestamp = null)
        => Serialize(CreateEnvelope(eventType, data, eventId, timestamp));
}
