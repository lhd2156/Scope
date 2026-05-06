using Scope.Core.API.Infrastructure;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Hubs;

[Authorize]
public sealed class LocationHub(CoreDbContext dbContext) : Hub
{
    public async Task ShareLocation(Guid tripId, double lat, double lng)
    {
        var userId = Context.GetRequiredUserId();
        var session = await dbContext.LiveSessions.FirstOrDefaultAsync(x => x.TripId == tripId && x.UserId == userId && x.IsActive);
        if (session is null) return;
        session.Latitude = lat;
        session.Longitude = lng;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync();
        await Clients.Group($"trip:{tripId}").SendAsync("LocationShared", new { tripId, userId, lat, lng });
    }

    public Task StopSharing(Guid tripId) => Clients.Group($"trip:{tripId}").SendAsync("LocationStopped", new { tripId, userId = Context.GetUserIdString() });
}
