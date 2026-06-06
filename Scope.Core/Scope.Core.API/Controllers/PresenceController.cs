using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize]
[Route("api/core/presence")]
public sealed class PresenceController(CoreDbContext dbContext) : ControllerBase
{
    private const int MaxRouteContextLength = 160;

    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "planning",
        "online",
        "idle",
        "offline",
    };

    [HttpPut("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] PresenceHeartbeatRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var now = DateTimeOffset.UtcNow;
        var requestedStatus = NormalizeStatus(request.Status, request.IsIdle, request.IsPlanning);
        var presence = await dbContext.UserPresences.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        var isNewPresence = presence is null;

        if (presence is null)
        {
            presence = new UserPresence
            {
                UserId = userId,
                LastActiveAt = now,
                UpdatedAt = now,
            };
            dbContext.UserPresences.Add(presence);
        }

        ApplyHeartbeat(presence, request, requestedStatus, now);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException) when (isNewPresence)
        {
            dbContext.Entry(presence).State = EntityState.Detached;
            presence = await dbContext.UserPresences.FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

            if (presence is null)
            {
                throw;
            }

            ApplyHeartbeat(presence, request, requestedStatus, now);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(new ApiResponse<object>(new
        {
            presence.UserId,
            presence.Status,
            presence.RouteContext,
            presence.IsIdle,
            presence.LastActiveAt,
            presence.LastPlanningAt,
            presence.UpdatedAt,
        }));
    }

    private static void ApplyHeartbeat(UserPresence presence, PresenceHeartbeatRequest request, string requestedStatus, DateTimeOffset now)
    {
        presence.Status = requestedStatus;
        presence.RouteContext = NormalizeRouteContext(request.RouteContext);
        presence.IsIdle = request.IsIdle || requestedStatus == "idle";
        presence.LastActiveAt = now;
        presence.UpdatedAt = now;

        if (request.IsPlanning || requestedStatus == "planning")
        {
            presence.LastPlanningAt = now;
        }
    }

    private static string? NormalizeRouteContext(string? routeContext)
    {
        var normalized = routeContext?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        return normalized.Length <= MaxRouteContextLength
            ? normalized
            : normalized[..MaxRouteContextLength];
    }

    private static string NormalizeStatus(string? status, bool isIdle, bool isPlanning)
    {
        if (isIdle)
        {
            return "idle";
        }

        if (isPlanning)
        {
            return "planning";
        }

        var normalized = (status ?? string.Empty).Trim().ToLowerInvariant();
        return AllowedStatuses.Contains(normalized) ? normalized : "online";
    }
}
