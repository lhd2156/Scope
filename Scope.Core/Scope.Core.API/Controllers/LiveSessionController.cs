using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize]
[Route("api/core/live")]
public sealed class LiveSessionController(
    CoreDbContext dbContext,
    IKafkaProducerService kafkaProducerService,
    ITripMembershipValidator tripMembershipValidator) : ControllerBase
{
    [HttpPost("start/{tripId:guid}")]
    public async Task<IActionResult> Start(Guid tripId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        if (!await IsTripMemberAsync(tripId, userId, cancellationToken))
        {
            return Forbid();
        }
        var existingSession = await dbContext.LiveSessions.FirstOrDefaultAsync(
            x => x.TripId == tripId && x.UserId == userId && x.IsActive,
            cancellationToken);
        if (existingSession is not null)
        {
            existingSession.LastPingAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new ApiResponse<object>(existingSession));
        }
        var session = new LiveSession { Id = Guid.NewGuid(), TripId = tripId, UserId = userId, Latitude = 0, Longitude = 0, IsActive = true, LastPingAt = DateTimeOffset.UtcNow };
        dbContext.LiveSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(session));
    }

    [HttpPut("ping")]
    public async Task<IActionResult> Ping([FromBody] PingLocationRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        if (!await IsTripMemberAsync(request.TripId, userId, cancellationToken))
        {
            return Forbid();
        }
        var session = await dbContext.LiveSessions.FirstOrDefaultAsync(x => x.TripId == request.TripId && x.UserId == userId && x.IsActive, cancellationToken);
        if (session is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "Live session not found" }));
        }
        session.Latitude = request.Latitude;
        session.Longitude = request.Longitude;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("live.location.updated", new { session.TripId, session.UserId, session.Latitude, session.Longitude }, cancellationToken);
        return Ok(new ApiResponse<object>(session));
    }

    [HttpGet("trip/{tripId:guid}")]
    public async Task<IActionResult> Trip(Guid tripId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        if (!await IsTripMemberAsync(tripId, userId, cancellationToken))
        {
            return Forbid();
        }

        return Ok(new ApiResponse<object>(await dbContext.LiveSessions.AsNoTracking().Where(x => x.TripId == tripId && x.IsActive).ToListAsync(cancellationToken)));
    }

    [HttpPost("stop/{tripId:guid}")]
    public async Task<IActionResult> Stop(Guid tripId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        if (!await IsTripMemberAsync(tripId, userId, cancellationToken))
        {
            return Forbid();
        }

        var session = await dbContext.LiveSessions.FirstOrDefaultAsync(
            x => x.TripId == tripId && x.UserId == userId && x.IsActive,
            cancellationToken);
        if (session is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "Live session not found" }));
        }

        session.IsActive = false;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("live.session.stopped", new { session.TripId, session.UserId }, cancellationToken);
        return Ok(new ApiResponse<object>(new { stopped = true }));
    }

    private async Task<bool> IsTripMemberAsync(Guid tripId, Guid userId, CancellationToken cancellationToken)
        => await tripMembershipValidator.IsMemberAsync(tripId, userId, GetBearerToken(), cancellationToken);

    private string GetBearerToken()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        return BearerTokens.FromAuthorizationHeader(authHeader);
    }
}
