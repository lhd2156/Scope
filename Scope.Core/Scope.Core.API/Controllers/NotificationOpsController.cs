using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize(Roles = "admin")]
[Route("api/core/notifications/admin")]
public sealed class NotificationOpsController(CoreDbContext dbContext) : ControllerBase
{
    [HttpGet("deliveries")]
    public async Task<IActionResult> Deliveries([FromQuery] string status = "failed", [FromQuery] int limit = 50, CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? "failed" : status.Trim().ToLowerInvariant();
        var rows = await dbContext.NotificationDeliveries
            .AsNoTracking()
            .Where(x => x.Status == normalizedStatus)
            .OrderByDescending(x => x.UpdatedAt)
            .Take(limit)
            .Select(x => new
            {
                x.Id,
                x.NotificationId,
                x.UserId,
                x.Channel,
                x.Status,
                x.Attempts,
                x.NextAttemptAt,
                x.ProviderMessageId,
                x.ErrorCode,
                x.LastError,
                x.CreatedAt,
                x.UpdatedAt,
            })
            .ToListAsync(cancellationToken);
        return Ok(new ApiResponse<object>(rows));
    }

    [HttpGet("outbox")]
    public async Task<IActionResult> Outbox([FromQuery] string status = "failed", [FromQuery] int limit = 50, CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 200);
        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? "failed" : status.Trim().ToLowerInvariant();
        var rows = await dbContext.NotificationOutbox
            .AsNoTracking()
            .Where(x => x.Status == normalizedStatus)
            .OrderByDescending(x => x.UpdatedAt)
            .Take(limit)
            .Select(x => new
            {
                x.Id,
                x.SourceEventId,
                x.EventType,
                x.Status,
                x.Attempts,
                x.AvailableAt,
                x.LastError,
                x.CreatedAt,
                x.UpdatedAt,
            })
            .ToListAsync(cancellationToken);
        return Ok(new ApiResponse<object>(rows));
    }

    [HttpPost("deliveries/{id:guid}/replay")]
    public async Task<IActionResult> ReplayDelivery(Guid id, CancellationToken cancellationToken)
    {
        var row = await dbContext.NotificationDeliveries.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "Delivery not found" }));
        }

        if (row.Status != "failed" && row.Status != "suppressed")
        {
            return Conflict(new ApiResponse<object>(new { message = "Only failed or suppressed deliveries can be replayed" }));
        }

        row.Status = "pending";
        row.NextAttemptAt = DateTimeOffset.UtcNow;
        row.ErrorCode = null;
        row.LastError = null;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(row));
    }

    [HttpPost("outbox/{id:guid}/replay")]
    public async Task<IActionResult> ReplayOutbox(Guid id, CancellationToken cancellationToken)
    {
        var row = await dbContext.NotificationOutbox.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "Outbox event not found" }));
        }

        if (row.Status != "failed")
        {
            return Conflict(new ApiResponse<object>(new { message = "Only failed outbox records can be replayed" }));
        }

        row.Status = "pending";
        row.AvailableAt = DateTimeOffset.UtcNow;
        row.LastError = null;
        row.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(row));
    }
}
