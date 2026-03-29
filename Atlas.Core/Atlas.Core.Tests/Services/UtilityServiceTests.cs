using System.Text.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Services;

public sealed class PasswordHasherServiceTests
{
    [Fact]
    public void HashAndVerify_RoundTripPassword()
    {
        var service = new PasswordHasherService();
        var hash = service.Hash("SecurePass123!");

        Assert.NotEqual("SecurePass123!", hash);
        Assert.True(service.Verify("SecurePass123!", hash));
        Assert.False(service.Verify("WrongPass123!", hash));
    }
}

public sealed class S3ServiceTests
{
    [Fact]
    public async Task SaveAvatarAsync_RejectsUnsupportedExtensionAndContentType()
    {
        var configuration = new ConfigurationBuilder().Build();
        var service = new S3Service(configuration);

        await Assert.ThrowsAsync<ValidationException>(() => service.SaveAvatarAsync(Guid.NewGuid(), "avatar.gif", "image/gif", new MemoryStream([1, 2, 3])));
        await Assert.ThrowsAsync<ValidationException>(() => service.SaveAvatarAsync(Guid.NewGuid(), "avatar.png", "image/gif", new MemoryStream([1, 2, 3])));
    }

    [Fact]
    public async Task SaveAvatarAsync_SavesFileToConfiguredMediaRoot()
    {
        var root = Path.Combine(Path.GetTempPath(), $"atlas-core-avatar-{Guid.NewGuid():N}");
        try
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    [CoreConfigurationKeys.MediaRoot] = root
                })
                .Build();
            var service = new S3Service(configuration);
            var userId = Guid.NewGuid();

            var relativePath = await service.SaveAvatarAsync(userId, "avatar.png", "image/png", new MemoryStream([1, 2, 3, 4]));

            var savedDirectory = Path.Combine(root, userId.ToString("N"));
            Assert.StartsWith($"{CoreDefaults.AvatarMediaPath}/{userId:N}/", relativePath, StringComparison.Ordinal);
            Assert.True(Directory.Exists(savedDirectory));
            Assert.Single(Directory.GetFiles(savedDirectory));
        }
        finally
        {
            if (Directory.Exists(root))
            {
                Directory.Delete(root, recursive: true);
            }
        }
    }
}

public sealed class KafkaProducerServiceTests
{
    [Fact]
    public async Task PublishAsync_ReturnsWithoutKafkaWhenBootstrapNotConfigured()
    {
        var configuration = new ConfigurationBuilder().Build();
        var logger = new Mock<ILogger<KafkaProducerService>>();
        var service = new KafkaProducerService(configuration, logger.Object);

        await service.PublishAsync(KafkaTopics.UserRegistered, new UserRegisteredEventData(Guid.NewGuid(), "louis", "louis@example.com"));

        logger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((_, _) => true),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.AtLeastOnce);
    }

    [Fact]
    public void KafkaEventSerializer_ProducesSectionTenEnvelopeWithCamelCaseFields()
    {
        var eventId = Guid.Parse("0f6d9d49-8e57-48ce-aa4b-0e59c1dc3e08");
        var userId = Guid.Parse("2bf86bc9-a63f-4967-a4b0-cd1ab90becc2");
        var timestamp = new DateTime(2026, 3, 29, 16, 10, 0, DateTimeKind.Utc);

        var json = KafkaEventSerializer.Serialize(
            KafkaTopics.UserRegistered,
            new UserRegisteredEventData(userId, "louis", "louis@example.com"),
            eventId,
            timestamp);

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert.Equal(new[] { "eventId", "eventType", "timestamp", "source", "data" }, root.EnumerateObject().Select(property => property.Name).ToArray());
        Assert.Equal(eventId.ToString(), root.GetProperty("eventId").GetString());
        Assert.Equal(KafkaTopics.UserRegistered, root.GetProperty("eventType").GetString());
        Assert.Equal("2026-03-29T16:10:00Z", root.GetProperty("timestamp").GetString());
        Assert.Equal(CoreDefaults.KafkaEventSource, root.GetProperty("source").GetString());

        var data = root.GetProperty("data");
        Assert.Equal(new[] { "userId", "username", "email" }, data.EnumerateObject().Select(property => property.Name).ToArray());
        Assert.Equal(userId.ToString(), data.GetProperty("userId").GetString());
        Assert.Equal("louis", data.GetProperty("username").GetString());
        Assert.Equal("louis@example.com", data.GetProperty("email").GetString());
    }

    [Fact]
    public void KafkaEventSerializer_PreservesDocumentedDataShapesForAllCoreTopics()
    {
        var samples = new (string Topic, object Data, string[] PropertyNames)[]
        {
            (KafkaTopics.UserRegistered, new UserRegisteredEventData(Guid.NewGuid(), "louis", "louis@example.com"), ["userId", "username", "email"]),
            (KafkaTopics.UserUpdated, new UserUpdatedEventData(Guid.NewGuid(), "louis", "Louis", "Explorer", "/media/avatars/louis.png"), ["userId", "username", "displayName", "bio", "avatarUrl"]),
            (KafkaTopics.FriendAccepted, new FriendAcceptedEventData(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()), ["friendshipId", "requesterId", "addresseeId"]),
            (KafkaTopics.LiveLocationUpdated, new LiveLocationUpdatedEventData(Guid.NewGuid(), Guid.NewGuid(), 32.7555, -97.3308), ["tripId", "userId", "latitude", "longitude"])
        };

        foreach (var sample in samples)
        {
            var json = KafkaEventSerializer.Serialize(sample.Topic, sample.Data, Guid.NewGuid(), new DateTime(2026, 3, 29, 16, 10, 0, DateTimeKind.Utc));
            using var document = JsonDocument.Parse(json);
            Assert.Equal(sample.PropertyNames, document.RootElement.GetProperty("data").EnumerateObject().Select(property => property.Name).ToArray());
        }
    }

    [Fact]
    public void KafkaTopics_MatchCoreArchitectureContract()
    {
        Assert.Equal(
            new[]
            {
                "user.registered",
                "user.updated",
                "friend.accepted",
                "live.location.updated"
            },
            new[]
            {
                KafkaTopics.UserRegistered,
                KafkaTopics.UserUpdated,
                KafkaTopics.FriendAccepted,
                KafkaTopics.LiveLocationUpdated
            });
    }
}
