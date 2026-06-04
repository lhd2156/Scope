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
[Route("api/core/social-safety")]
public sealed class SocialSafetyController(CoreDbContext dbContext) : ControllerBase
{
    [HttpGet("blocks")]
    public async Task<IActionResult> Blocks(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var rows = await dbContext.UserBlocks
            .AsNoTracking()
            .Where(x => x.BlockerId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        return Ok(new ApiResponse<object>(rows));
    }

    [HttpPost("blocks/{blockedUserId:guid}")]
    public async Task<IActionResult> Block(Guid blockedUserId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        if (userId == blockedUserId)
        {
            return BadRequest(new ApiResponse<object>(new { message = "Cannot block yourself" }));
        }

        var targetExists = await dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == blockedUserId && x.IsActive, cancellationToken);
        if (!targetExists)
        {
            return NotFound(new ApiResponse<object>(new { message = "User not found" }));
        }

        var block = await dbContext.UserBlocks.FirstOrDefaultAsync(
            x => x.BlockerId == userId && x.BlockedId == blockedUserId,
            cancellationToken);
        if (block is null)
        {
            block = new UserBlock
            {
                Id = Guid.NewGuid(),
                BlockerId = userId,
                BlockedId = blockedUserId,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            dbContext.UserBlocks.Add(block);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(new ApiResponse<object>(block));
    }

    [HttpDelete("blocks/{blockedUserId:guid}")]
    public async Task<IActionResult> Unblock(Guid blockedUserId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var block = await dbContext.UserBlocks.FirstOrDefaultAsync(
            x => x.BlockerId == userId && x.BlockedId == blockedUserId,
            cancellationToken);
        if (block is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "Block not found" }));
        }

        dbContext.UserBlocks.Remove(block);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("reports")]
    public async Task<IActionResult> Report([FromBody] ReportRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var report = new UserReport
        {
            Id = Guid.NewGuid(),
            ReporterId = userId,
            TargetUserId = request.TargetUserId,
            TargetType = TextNormalization.Required(request.TargetType, "unknown", 60),
            TargetId = TextNormalization.Required(request.TargetId, "unknown", 120),
            Reason = TextNormalization.Required(request.Reason, "other", 80),
            Details = TextNormalization.Optional(request.Details, 1000),
            Status = "open",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        dbContext.UserReports.Add(report);
        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(report));
    }

}
