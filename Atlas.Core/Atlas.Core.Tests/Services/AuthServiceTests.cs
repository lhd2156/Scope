using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Services;

public sealed class AuthServiceTests
{
    [Fact]
    public async Task RegisterAsync_CreatesUserAndPublishesEvent()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var dbContext = new CoreDbContext(options);
        var jwt = new Mock<IJwtTokenService>();
        jwt.Setup(x => x.CreateTokens(It.IsAny<User>())).Returns(new Atlas.Core.Domain.Models.TokenPair("access", "refresh", DateTimeOffset.UtcNow.AddMinutes(15)));
        var kafka = new Mock<IKafkaProducerService>();
        var service = new AuthService(dbContext, new PasswordHasherService(), jwt.Object, kafka.Object);

        var result = await service.RegisterAsync("louis", "louis@example.com", "SecurePass123!", "Louis");

        Assert.Equal("louis", result.Username);
        Assert.Single(dbContext.Users);
        kafka.Verify(x => x.PublishAsync("user.registered", It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
