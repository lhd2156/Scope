using System.Text.Json;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class SignalRHubConnectionIntegrationTests
{
    [Theory]
    [InlineData("/api/core/hubs/trips")]
    [InlineData("/api/core/hubs/location")]
    [InlineData("/api/core/hubs/notifications")]
    public async Task AuthenticatedClients_CanEstablishRealSignalRConnections(string hubPath)
    {
        using var factory = new ApiTestWebApplicationFactory();
        await using var connection = SignalRTestConnectionFactory.CreateAuthenticatedHubConnection(factory, hubPath, Guid.NewGuid());

        await connection.StartAsync();

        Assert.Equal(HubConnectionState.Connected, connection.State);
        Assert.False(string.IsNullOrWhiteSpace(connection.ConnectionId));
    }

    [Fact]
    public async Task TripHub_AllowsJoinedClientsToReceiveSpotBroadcastsOverRealConnections()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var tripId = Guid.NewGuid();
        var receivedSpot = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);

        await using var sender = SignalRTestConnectionFactory.CreateAuthenticatedHubConnection(factory, "/api/core/hubs/trips", Guid.NewGuid(), email: "sender@example.com", displayName: "Sender");
        await using var receiver = SignalRTestConnectionFactory.CreateAuthenticatedHubConnection(factory, "/api/core/hubs/trips", Guid.NewGuid(), email: "receiver@example.com", displayName: "Receiver");
        receiver.On<JsonElement>("SpotAdded", spot => receivedSpot.TrySetResult(spot));

        await sender.StartAsync();
        await receiver.StartAsync();
        await sender.InvokeAsync("JoinTrip", tripId);
        await receiver.InvokeAsync("JoinTrip", tripId);

        await sender.InvokeAsync("SpotAdded", tripId, new { id = 7, title = "Hill Country Stop" });

        var spot = await receivedSpot.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(7, spot.GetProperty("id").GetInt32());
        Assert.Equal("Hill Country Stop", spot.GetProperty("title").GetString());
    }

    [Fact]
    public async Task LocationHub_ShareLocation_UpdatesLiveSessionOverRealConnection()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var userId = Guid.NewGuid();
        var tripId = Guid.NewGuid();

        await factory.SeedAsync(db =>
        {
            db.Users.Add(TestSupport.CreateUser(id: userId));
            db.LiveSessions.Add(new LiveSession
            {
                Id = Guid.NewGuid(),
                TripId = tripId,
                UserId = userId,
                IsActive = true,
                Latitude = 0,
                Longitude = 0,
                LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-5)
            });
        });

        await using var connection = SignalRTestConnectionFactory.CreateAuthenticatedHubConnection(factory, "/api/core/hubs/location", userId);

        await connection.StartAsync();
        await connection.InvokeAsync("ShareLocation", tripId, 32.7555, -97.3308);

        var session = await factory.ExecuteDbContextAsync(db => db.LiveSessions.AsNoTracking().SingleAsync(x => x.TripId == tripId && x.UserId == userId));
        Assert.Equal(32.7555, session.Latitude);
        Assert.Equal(-97.3308, session.Longitude);
        Assert.True(session.LastPingAt > DateTimeOffset.UtcNow.AddMinutes(-1));
    }
}
