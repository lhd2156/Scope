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
public sealed class LiveSessionController(CoreDbContext dbContext, IKafkaProducerService kafkaProducerService) : ControllerBase
{
    [HttpPost("start/{tripId:guid}")]
    public async Task<IActionResult> Start(Guid tripId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var session = new LiveSession { Id = Guid.NewGuid(), TripId = tripId, UserId = userId, Latitude = 0, Longitude = 0, IsActive = true, LastPingAt = DateTimeOffset.UtcNow };
        dbContext.LiveSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(session));
    }

    [HttpPut("ping")]
    public async Task<IActionResult> Ping([FromBody] PingLocationRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var session = await dbContext.LiveSessions.FirstAsync(x => x.TripId == request.TripId && x.UserId == userId && x.IsActive, cancellationToken);
        session.Latitude = request.Latitude;
        session.Longitude = request.Longitude;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("live.location.updated", new { session.TripId, session.UserId, session.Latitude, session.Longitude }, cancellationToken);
        return Ok(new ApiResponse<object>(session));
    }

    [HttpGet("trip/{tripId:guid}")]
    public async Task<IActionResult> Trip(Guid tripId, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await dbContext.LiveSessions.AsNoTracking().Where(x => x.TripId == tripId && x.IsActive).ToListAsync(cancellationToken)));
}
