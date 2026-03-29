using Atlas.Core.API.Controllers;
using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class UsersControllerTests
{
    [Fact]
    public async Task Get_ReturnsUserProfileForActiveUser()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);

        var result = await controller.Get(user.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Get_ThrowsNotFoundWhenUserMissing()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var controller = BuildController(dbContext);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.Get(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task Update_TrimsFieldsPersistsChangesAndPublishesEvent()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var kafka = new Mock<IKafkaProducerService>();
        var controller = BuildController(dbContext, kafkaProducer: kafka.Object);
        TestSupport.AttachUser(controller, user.Id);

        var result = await controller.Update(user.Id, new UpdateUserRequest("  Updated Name  ", "  Explorer bio  "), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Updated Name", user.DisplayName);
        Assert.Equal("Explorer bio", user.Bio);
        kafka.Verify(x => x.PublishAsync(KafkaTopics.UserUpdated, It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_ThrowsForbiddenForDifferentAuthenticatedUser()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, Guid.NewGuid());

        await Assert.ThrowsAsync<ForbiddenException>(() => controller.Update(user.Id, new UpdateUserRequest("Updated", null), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_DeactivatesUserAndRevokesRefreshTokens()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            User = user,
            Token = "refresh-token",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-30),
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        });
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, user.Id);

        var result = await controller.Delete(user.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.False(user.IsActive);
        Assert.All(dbContext.RefreshTokens, token => Assert.NotNull(token.RevokedAt));
    }

    [Fact]
    public async Task Search_ReturnsEmptyResultWhenQueryBlank()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var controller = BuildController(dbContext);

        var result = await controller.Search("   ", CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Search_ReturnsMatchingActiveUsersOnly()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        dbContext.Users.AddRange(
            TestSupport.CreateUser(username: "louis", displayName: "Louis Do"),
            TestSupport.CreateUser(username: "lucy", email: "lucy@example.com", displayName: "Lucy"),
            TestSupport.CreateUser(username: "inactive-louis", email: "inactive@example.com", displayName: "Louis Ghost", isActive: false));
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);

        var result = await controller.Search("loui", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<Atlas.Core.Domain.Models.ApiResponse<object>>(ok.Value);
        var json = System.Text.Json.JsonSerializer.Serialize(payload.Data);
        Assert.Contains("Louis Do", json, StringComparison.Ordinal);
        Assert.DoesNotContain("Louis Ghost", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Avatar_SavesFileUpdatesUserAndPublishesEvent()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var kafka = new Mock<IKafkaProducerService>();
        var storage = new Mock<IAvatarStorageService>();
        storage.Setup(x => x.SaveAvatarAsync(user.Id, "avatar.png", "image/png", It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("/media/avatars/avatar.png");

        var controller = BuildController(dbContext, kafka.Object, storage.Object);
        TestSupport.AttachUser(controller, user.Id);
        var request = new AvatarUploadRequest { File = TestSupport.CreateFormFile("avatar.png", "image/png", [1, 2, 3, 4]) };

        var result = await controller.Avatar(user.Id, request, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("/media/avatars/avatar.png", user.AvatarUrl);
        kafka.Verify(x => x.PublishAsync(KafkaTopics.UserUpdated, It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Avatar_RejectsMissingFile()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, user.Id);

        await Assert.ThrowsAsync<ValidationException>(() => controller.Avatar(user.Id, new AvatarUploadRequest(), CancellationToken.None));
    }

    [Fact]
    public async Task Stats_ReturnsFriendCountForExistingUser()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        var friend = TestSupport.CreateUser(email: "friend@example.com", username: "friend", displayName: "Friend");
        dbContext.Users.AddRange(user, friend);
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = user.Id,
            AddresseeId = friend.Id,
            Status = FriendshipStatuses.Accepted,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);

        var result = await controller.Stats(user.Id, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Stats_ThrowsNotFoundForMissingUser()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var controller = BuildController(dbContext);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.Stats(Guid.NewGuid(), CancellationToken.None));
    }

    private static UsersController BuildController(
        CoreDbContext dbContext,
        IKafkaProducerService? kafkaProducer = null,
        IAvatarStorageService? avatarStorage = null)
        => new(
            dbContext,
            kafkaProducer ?? Mock.Of<IKafkaProducerService>(),
            avatarStorage ?? Mock.Of<IAvatarStorageService>());
}
