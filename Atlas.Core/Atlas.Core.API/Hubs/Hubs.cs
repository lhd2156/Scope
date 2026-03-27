using Atlas.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Core.API.Hubs;

[Authorize]
public sealed class TripHub : Hub
{
    public Task JoinTrip(Guid tripId) => Groups.AddToGroupAsync(Context.ConnectionId, $"trip:{tripId}");
    public Task LeaveTrip(Guid tripId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, $"trip:{tripId}");
    public Task SpotAdded(Guid tripId, object spot) => Clients.Group($"trip:{tripId}").SendAsync("SpotAdded", spot);
    public Task TripUpdated(Guid tripId, object changes) => Clients.Group($"trip:{tripId}").SendAsync("TripUpdated", changes);
    public Task MemberJoined(Guid tripId, object user) => Clients.Group($"trip:{tripId}").SendAsync("MemberJoined", user);
}

[Authorize]
public sealed class LocationHub(CoreDbContext dbContext) : Hub
{
    public async Task ShareLocation(Guid tripId, double lat, double lng)
    {
        var userId = Guid.Parse(Context.UserIdentifier ?? Context.User?.FindFirst("sub")?.Value!);
        var session = await dbContext.LiveSessions.FirstOrDefaultAsync(x => x.TripId == tripId && x.UserId == userId && x.IsActive);
        if (session is null) return;
        session.Latitude = lat;
        session.Longitude = lng;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync();
        await Clients.Group($"trip:{tripId}").SendAsync("LocationShared", new { tripId, userId, lat, lng });
    }

    public Task StopSharing(Guid tripId) => Clients.Group($"trip:{tripId}").SendAsync("LocationStopped", new { tripId, userId = Context.UserIdentifier });
}

[Authorize]
public sealed class NotificationHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier ?? Context.User?.FindFirst("sub")?.Value;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        }
        await base.OnConnectedAsync();
    }
}
