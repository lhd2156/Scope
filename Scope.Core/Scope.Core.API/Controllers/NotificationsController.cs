using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize]
[Route("api/core/notifications")]
public sealed class NotificationsController(CoreDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;
        var query = dbContext.Notifications.AsNoTracking().Where(x => x.UserId == userId).OrderByDescending(x => x.CreatedAt);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return Ok(new ApiResponse<object>(items, new { page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) }));
    }

    /// <summary>
    /// Count of notifications the caller hasn't marked as read yet. Used by
    /// the frontend navbar badge; cheap covered-index count.
    /// </summary>
    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var count = await dbContext.Notifications
            .AsNoTracking()
            .CountAsync(x => x.UserId == userId && !x.IsRead, cancellationToken);
        return Ok(new ApiResponse<object>(new { count }));
    }

    /// <summary>
    /// Mark a single notification as read. No-op if already read. Returns
    /// 404 for missing or cross-user notification ids so we never leak that
    /// a notification exists belonging to someone else.
    /// </summary>
    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (notification is null || notification.UserId != userId)
        {
            return NotFound(new ApiResponse<object>(new { message = "Notification not found" }));
        }
        if (!notification.IsRead)
        {
            notification.IsRead = true;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return Ok(new ApiResponse<object>(notification));
    }

    /// <summary>
    /// Mark all of the caller's notifications as read. Returns the count
    /// updated so the client can reconcile its unread badge immediately.
    /// </summary>
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var unread = await dbContext.Notifications
            .Where(x => x.UserId == userId && !x.IsRead)
            .ToListAsync(cancellationToken);
        foreach (var row in unread)
        {
            row.IsRead = true;
        }
        if (unread.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return Ok(new ApiResponse<object>(new { updated = unread.Count }));
    }
}
