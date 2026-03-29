using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Exceptions;
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

        await service.PublishAsync("user.registered", new { id = Guid.NewGuid() });

        logger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((_, _) => true),
                It.IsAny<Exception?>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.AtLeastOnce);
    }
}
