using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Hubs;

[Authorize]
public sealed class LocationHub(CoreDbContext dbContext, ITripMembershipValidator membershipValidator) : Hub
{
    public async Task JoinTrip(Guid tripId)
    {
        var userId = Context.GetRequiredUserId();
        if (!await membershipValidator.IsMemberAsync(tripId, userId, GetBearerToken(), Context.ConnectionAborted))
        {
            throw new HubException("Not a member of this trip");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"trip:{tripId}");
    }

    public Task LeaveTrip(Guid tripId)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, $"trip:{tripId}");

    public async Task ShareLocation(Guid tripId, double lat, double lng)
    {
        if (!IsValidCoordinate(lat, -90, 90) || !IsValidCoordinate(lng, -180, 180))
        {
            throw new HubException("Invalid coordinates");
        }

        var userId = Context.GetRequiredUserId();
        var session = await dbContext.LiveSessions.FirstOrDefaultAsync(x => x.TripId == tripId && x.UserId == userId && x.IsActive);
        if (session is null) return;
        if (!await membershipValidator.IsMemberAsync(tripId, userId, GetBearerToken(), Context.ConnectionAborted))
        {
            session.IsActive = false;
            session.LastPingAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync();
            return;
        }

        session.Latitude = lat;
        session.Longitude = lng;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync();
        await Clients.Group($"trip:{tripId}").SendAsync("LocationShared", new { tripId, userId, lat, lng });
    }

    public async Task StopSharing(Guid tripId)
    {
        var userId = Context.GetRequiredUserId();
        var session = await dbContext.LiveSessions.FirstOrDefaultAsync(x => x.TripId == tripId && x.UserId == userId && x.IsActive);
        if (session is null) return;

        session.IsActive = false;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync();
        await Clients.Group($"trip:{tripId}").SendAsync("LocationStopped", new { tripId, userId });
    }

    private string GetBearerToken()
    {
        var authHeader = Context.GetHttpContext()?.Request.Headers["Authorization"].ToString();
        return BearerTokens.FromAuthorizationHeader(authHeader);
    }

    private static bool IsValidCoordinate(double value, double min, double max)
        => !double.IsNaN(value) && !double.IsInfinity(value) && value >= min && value <= max;
}
