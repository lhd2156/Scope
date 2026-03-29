using System.Net;
using System.Net.Http.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class NotificationsEndpointsIntegrationTests
{
    [Fact]
    public async Task NotificationsEndpoints_HappyPath_CoversListReadReadAllDeleteAndUnreadCount()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        var unreadNotification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Type = NotificationTypes.FriendRequest,
            Title = "Friend request",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };
        var secondNotification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Type = NotificationTypes.FriendAccepted,
            Title = "Accepted",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        };
        await factory.SeedAsync(db =>
        {
            db.Users.Add(user);
            db.Notifications.AddRange(unreadNotification, secondNotification);
        });
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);

        var listResponse = await client.GetAsync("/api/core/notifications?page=1&pageSize=20");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var listPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(listResponse);
        Assert.Contains(unreadNotification.Id.ToString(), listPayload.Data.ToString(), StringComparison.Ordinal);

        var readResponse = await client.PutAsync($"/api/core/notifications/{unreadNotification.Id}/read", JsonContent.Create(new { }));
        Assert.Equal(HttpStatusCode.OK, readResponse.StatusCode);

        var readAllResponse = await client.PutAsync("/api/core/notifications/read-all", JsonContent.Create(new { }));
        Assert.Equal(HttpStatusCode.OK, readAllResponse.StatusCode);

        var unreadCountResponse = await client.GetAsync("/api/core/notifications/unread-count");
        Assert.Equal(HttpStatusCode.OK, unreadCountResponse.StatusCode);
        var unreadCountPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(unreadCountResponse);
        Assert.Equal(0, unreadCountPayload.Data.GetProperty("unreadCount").GetInt32());

        var deleteResponse = await client.DeleteAsync($"/api/core/notifications/{secondNotification.Id}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.Equal(1, await factory.ExecuteDbContextAsync(db => Task.FromResult(db.Notifications.Count())));
    }

    [Fact]
    public async Task NotificationsEndpoints_ErrorPaths_ReturnExpectedStatusCodes()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db => db.Users.Add(user));
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);

        var missingRead = await client.PutAsync($"/api/core/notifications/{Guid.NewGuid()}/read", JsonContent.Create(new { }));
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingRead, StatusCodes.Status404NotFound, "NOT_FOUND");

        var missingDelete = await client.DeleteAsync($"/api/core/notifications/{Guid.NewGuid()}");
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingDelete, StatusCodes.Status404NotFound, "NOT_FOUND");
    }
}

public sealed class LiveEndpointsIntegrationTests
{
    [Fact]
    public async Task LiveEndpoints_HappyPath_CoversStartPingTripAndStop()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        var otherUser = TestSupport.CreateUser(username: "other", email: "other@example.com", displayName: "Other User");
        var tripId = Guid.NewGuid();
        await factory.SeedAsync(db =>
        {
            db.Users.AddRange(user, otherUser);
            db.LiveSessions.Add(new LiveSession
            {
                Id = Guid.NewGuid(),
                TripId = tripId,
                UserId = otherUser.Id,
                Latitude = 41.0,
                Longitude = -87.0,
                IsActive = true,
                LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-2)
            });
        });
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);

        var startResponse = await client.PostAsync($"/api/core/live/start/{tripId}", null);
        Assert.Equal(HttpStatusCode.Created, startResponse.StatusCode);

        var pingResponse = await client.PutAsJsonAsync("/api/core/live/ping", new
        {
            tripId,
            latitude = 32.7555,
            longitude = -97.3308
        });
        Assert.Equal(HttpStatusCode.OK, pingResponse.StatusCode);

        var tripResponse = await client.GetAsync($"/api/core/live/trip/{tripId}");
        Assert.Equal(HttpStatusCode.OK, tripResponse.StatusCode);
        var tripPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(tripResponse);
        var tripJson = tripPayload.Data.ToString();
        Assert.Contains(user.Id.ToString(), tripJson, StringComparison.Ordinal);
        Assert.Contains(otherUser.Id.ToString(), tripJson, StringComparison.Ordinal);

        var stopResponse = await client.PostAsJsonAsync("/api/core/live/stop", new { tripId });
        Assert.Equal(HttpStatusCode.OK, stopResponse.StatusCode);
        var activeSessions = await factory.ExecuteDbContextAsync(db => db.LiveSessions.Where(x => x.TripId == tripId && x.IsActive).CountAsync());
        Assert.Equal(1, activeSessions);
    }

    [Fact]
    public async Task LiveEndpoints_ErrorPaths_ReturnExpectedStatusCodes()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db => db.Users.Add(user));
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);
        var tripId = Guid.NewGuid();

        var missingPing = await client.PutAsJsonAsync("/api/core/live/ping", new
        {
            tripId,
            latitude = 32.7555,
            longitude = -97.3308
        });
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingPing, StatusCodes.Status404NotFound, "NOT_FOUND");

        var missingStop = await client.PostAsJsonAsync("/api/core/live/stop", new { tripId });
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingStop, StatusCodes.Status404NotFound, "NOT_FOUND");
    }
}

public sealed class HealthEndpointsIntegrationTests
{
    [Fact]
    public async Task HealthEndpoint_ReturnsHealthyWhenKafkaConfigurationExists()
    {
        using var factory = new KafkaConfiguredApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync("/api/core/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);
        Assert.Equal("healthy", document.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task HealthEndpoint_ReturnsDegradedWhenKafkaConfigurationMissing()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync("/api/core/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);
        Assert.Equal("degraded", document.RootElement.GetProperty("status").GetString());
    }
}
