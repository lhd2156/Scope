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
        if (!await EnsureEditorAsync(tripId)) throw new HubException("Edit access is required for this trip");
        await Clients.Group($"trip:{tripId}").SendAsync("SpotAdded", spot);
    }

    public async Task TripUpdated(Guid tripId, object changes)
    {
        if (!await EnsureEditorAsync(tripId)) throw new HubException("Edit access is required for this trip");
        await Clients.Group($"trip:{tripId}").SendAsync("TripUpdated", changes);
    }

    public async Task MemberJoined(Guid tripId, object user)
    {
        if (!await EnsureOwnerAsync(tripId)) throw new HubException("Owner access is required for this trip");
        await Clients.Group($"trip:{tripId}").SendAsync("MemberJoined", user);
    }

    private async Task<bool> EnsureMemberAsync(Guid tripId)
    {
        var userId = Context.GetRequiredUserId();
        var ok = await membershipValidator.IsMemberAsync(tripId, userId, GetBearerToken(), Context.ConnectionAborted);
        if (!ok)
        {
            logger.LogWarning("Rejected TripHub join: user {UserId} is not a member of trip {TripId}", userId, tripId);
        }
        return ok;
    }

    private async Task<bool> EnsureEditorAsync(Guid tripId)
    {
        var role = await GetRoleAsync(tripId);
        var ok = role is "owner" or "editor";
        if (!ok)
        {
            logger.LogWarning("Rejected TripHub edit: role {Role} cannot edit trip {TripId}", role ?? "none", tripId);
        }
        return ok;
    }

    private async Task<bool> EnsureOwnerAsync(Guid tripId)
    {
        var role = await GetRoleAsync(tripId);
        var ok = role is "owner";
        if (!ok)
        {
            logger.LogWarning("Rejected TripHub owner action: role {Role} cannot manage trip {TripId}", role ?? "none", tripId);
        }
        return ok;
    }

    private async Task<string?> GetRoleAsync(Guid tripId)
    {
        var userId = Context.GetRequiredUserId();
        var bearer = GetBearerToken();
        return await membershipValidator.GetRoleAsync(tripId, userId, bearer, Context.ConnectionAborted);
    }

    private string GetBearerToken()
    {
        var authHeader = Context.GetHttpContext()?.Request.Headers["Authorization"].ToString();
        return BearerTokens.FromAuthorizationHeader(authHeader);
    }
}
