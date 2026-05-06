using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Scope.Core.API.Hubs;

[Authorize]
public sealed class TripHub(ITripMembershipValidator membershipValidator, ILogger<TripHub> logger) : Hub
{
    public async Task JoinTrip(Guid tripId)
    {
        if (!await EnsureMemberAsync(tripId))
        {
            throw new HubException("Not a member of this trip");
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, $"trip:{tripId}");
    }

    public Task LeaveTrip(Guid tripId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, $"trip:{tripId}");

    public async Task SpotAdded(Guid tripId, object spot)
    {
        if (!await EnsureMemberAsync(tripId)) throw new HubException("Not a member of this trip");
        await Clients.Group($"trip:{tripId}").SendAsync("SpotAdded", spot);
    }

    public async Task TripUpdated(Guid tripId, object changes)
    {
        if (!await EnsureMemberAsync(tripId)) throw new HubException("Not a member of this trip");
        await Clients.Group($"trip:{tripId}").SendAsync("TripUpdated", changes);
    }

    public async Task MemberJoined(Guid tripId, object user)
    {
        if (!await EnsureMemberAsync(tripId)) throw new HubException("Not a member of this trip");
        await Clients.Group($"trip:{tripId}").SendAsync("MemberJoined", user);
    }

    private async Task<bool> EnsureMemberAsync(Guid tripId)
    {
        var userId = Context.GetRequiredUserId();
        var authHeader = Context.GetHttpContext()?.Request.Headers["Authorization"].ToString();
        var bearer = string.Empty;
        if (!string.IsNullOrWhiteSpace(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            bearer = authHeader["Bearer ".Length..].Trim();
        }
        var ok = await membershipValidator.IsMemberAsync(tripId, userId, bearer, Context.ConnectionAborted);
        if (!ok)
        {
            logger.LogWarning("Rejected TripHub join: user {UserId} is not a member of trip {TripId}", userId, tripId);
        }
        return ok;
    }
}
