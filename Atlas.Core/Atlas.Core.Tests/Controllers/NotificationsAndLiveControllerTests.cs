using Atlas.Core.API.Controllers;
using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Data;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Controllers;

public sealed class NotificationsControllerTests
{
    [Fact]
    public async Task List_NormalizesPaginationAndReturnsPagedNotifications()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        dbContext.Notifications.AddRange(
            new Notification { Id = Guid.NewGuid(), UserId = user.Id, Type = NotificationTypes.FriendRequest, Title = "A", CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5) },
            new Notification { Id = Guid.NewGuid(), UserId = user.Id, Type = NotificationTypes.FriendAccepted, Title = "B", CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-1) });
        await dbContext.SaveChangesAsync();

        var controller = new NotificationsController(dbContext);
        TestSupport.AttachUser(controller, user.Id);

        var result = await controller.List(0, 1000, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var payload = Assert.IsType<Atlas.Core.Domain.Models.ApiResponse<object>>(ok.Value);
        var json = System.Text.Json.JsonSerializer.Serialize(payload.Meta);
        Assert.Contains($"\"pageSize\":{CoreLimits.MaxNotificationPageSize}", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Read_ReadAll_DeleteAndUnreadCount_WorkAgainstCurrentUserNotifications()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        var notification = new Notification { Id = Guid.NewGuid(), UserId = user.Id, Type = NotificationTypes.FriendRequest, Title = "A", CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5) };
        var second = new Notification { Id = Guid.NewGuid(), UserId = user.Id, Type = NotificationTypes.FriendAccepted, Title = "B", CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-1) };
        dbContext.Users.Add(user);
        dbContext.Notifications.AddRange(notification, second);
        await dbContext.SaveChangesAsync();

        var controller = new NotificationsController(dbContext);
        TestSupport.AttachUser(controller, user.Id);

        Assert.IsType<OkObjectResult>(await controller.Read(notification.Id, CancellationToken.None));
        Assert.True(notification.IsRead);

        Assert.IsType<OkObjectResult>(await controller.ReadAll(CancellationToken.None));
        Assert.All(dbContext.Notifications, item => Assert.True(item.IsRead));

        Assert.IsType<OkObjectResult>(await controller.UnreadCount(CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.Delete(second.Id, CancellationToken.None));
        Assert.Single(dbContext.Notifications);
    }

    [Fact]
    public async Task Read_ThrowsNotFoundForMissingNotification()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var controller = new NotificationsController(dbContext);
        TestSupport.AttachUser(controller, Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => controller.Read(Guid.NewGuid(), CancellationToken.None));
    }
}

public sealed class LiveSessionControllerTests
{
    [Fact]
    public async Task Start_CreatesNewSessionAndReturnsExistingSessionOnRepeat()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, user.Id);
        var tripId = Guid.NewGuid();

        var created = await controller.Start(tripId, CancellationToken.None);
        var existing = await controller.Start(tripId, CancellationToken.None);

        var createdResult = Assert.IsType<ObjectResult>(created);
        Assert.Equal(201, createdResult.StatusCode);
        Assert.IsType<OkObjectResult>(existing);
        Assert.Single(dbContext.LiveSessions);
    }

    [Fact]
    public async Task Ping_UpdatesLocationAndPublishesEvent()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        var tripId = Guid.NewGuid();
        dbContext.Users.Add(user);
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = user.Id,
            IsActive = true,
            Latitude = 0,
            Longitude = 0,
            LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        });
        await dbContext.SaveChangesAsync();

        var kafka = new Mock<IKafkaProducerService>();
        var controller = BuildController(dbContext, kafka.Object);
        TestSupport.AttachUser(controller, user.Id);

        var result = await controller.Ping(new PingLocationRequest(tripId, 32.7555, -97.3308), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal(32.7555, dbContext.LiveSessions.Single().Latitude);
        Assert.Equal(-97.3308, dbContext.LiveSessions.Single().Longitude);
        kafka.Verify(x => x.PublishAsync(
            KafkaTopics.LiveLocationUpdated,
            It.Is<object>(payload => payload is LiveLocationUpdatedEventData
                && ((LiveLocationUpdatedEventData)payload).TripId == tripId
                && ((LiveLocationUpdatedEventData)payload).UserId == user.Id
                && ((LiveLocationUpdatedEventData)payload).Latitude == 32.7555
                && ((LiveLocationUpdatedEventData)payload).Longitude == -97.3308),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Stop_DeactivatesSessionsAndTrip_ReturnsOnlyActiveSessions()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        var otherUser = TestSupport.CreateUser(username: "friend", email: "friend@example.com", displayName: "Friend User");
        var tripId = Guid.NewGuid();
        dbContext.Users.AddRange(user, otherUser);
        dbContext.LiveSessions.AddRange(
            new LiveSession { Id = Guid.NewGuid(), TripId = tripId, UserId = user.Id, IsActive = true, Latitude = 1, Longitude = 2, LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-5) },
            new LiveSession { Id = Guid.NewGuid(), TripId = tripId, UserId = otherUser.Id, IsActive = true, Latitude = 3, Longitude = 4, LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-2) });
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, user.Id);

        Assert.IsType<OkObjectResult>(await controller.Stop(new StopLiveSessionRequest(tripId), CancellationToken.None));
        Assert.False(dbContext.LiveSessions.Single(x => x.UserId == user.Id).IsActive);

        var tripResult = await controller.Trip(tripId, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(tripResult);
        var payload = Assert.IsType<Atlas.Core.Domain.Models.ApiResponse<object>>(ok.Value);
        var json = System.Text.Json.JsonSerializer.Serialize(payload.Data);
        Assert.Contains(otherUser.Id.ToString(), json, StringComparison.Ordinal);
        Assert.DoesNotContain(user.Id.ToString(), json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task PingAndStop_ThrowNotFoundWhenSessionMissing()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var user = TestSupport.CreateUser();
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();

        var controller = BuildController(dbContext);
        TestSupport.AttachUser(controller, user.Id);
        var tripId = Guid.NewGuid();

        await Assert.ThrowsAsync<NotFoundException>(() => controller.Ping(new PingLocationRequest(tripId, 1, 2), CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => controller.Stop(new StopLiveSessionRequest(tripId), CancellationToken.None));
    }

    private static LiveSessionController BuildController(CoreDbContext dbContext, IKafkaProducerService? kafkaProducerService = null)
        => new(dbContext, kafkaProducerService ?? Mock.Of<IKafkaProducerService>());
}

public sealed class HealthControllerTests
{
    [Fact]
    public async Task Get_ReturnsHealthyWhenDatabaseAndKafkaChecksSucceed()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var kafkaHealthCheck = new Mock<IKafkaHealthCheckService>();
        kafkaHealthCheck.Setup(x => x.IsHealthyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var controller = new HealthController(dbContext, kafkaHealthCheck.Object);

        var result = await controller.Get(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("healthy", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Get_ReturnsDegradedWhenKafkaCheckFails()
    {
        await using var dbContext = TestSupport.CreateDbContext();
        var kafkaHealthCheck = new Mock<IKafkaHealthCheckService>();
        kafkaHealthCheck.Setup(x => x.IsHealthyAsync(It.IsAny<CancellationToken>())).ReturnsAsync(false);
        var controller = new HealthController(dbContext, kafkaHealthCheck.Object);

        var result = await controller.Get(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
        Assert.Contains("degraded", json, StringComparison.Ordinal);
    }
}
