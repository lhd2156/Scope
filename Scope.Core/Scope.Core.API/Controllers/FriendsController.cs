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
[Route("api/core/friends")]
public sealed class FriendsController(CoreDbContext dbContext, IKafkaProducerService kafkaProducerService) : ControllerBase
{
    [HttpPost("request/{userId:guid}")]
    public async Task<IActionResult> CreateRequest(Guid userId, CancellationToken cancellationToken)
    {
        var requesterId = User.GetRequiredUserId();
        if (requesterId == userId)
        {
            return BadRequest(new ApiResponse<object>(new { message = "Cannot friend yourself" }));
        }
        var targetExists = await dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == userId && x.IsActive, cancellationToken);
        if (!targetExists)
        {
            return NotFound(new ApiResponse<object>(new { message = "User not found" }));
        }
        var duplicate = await dbContext.Friendships.AsNoTracking().AnyAsync(
            x => (x.RequesterId == requesterId && x.AddresseeId == userId) || (x.RequesterId == userId && x.AddresseeId == requesterId),
            cancellationToken);
        if (duplicate)
        {
            return Conflict(new ApiResponse<object>(new { message = "Friendship already exists" }));
        }
        var friendship = new Friendship { Id = Guid.NewGuid(), RequesterId = requesterId, AddresseeId = userId, Status = "pending", CreatedAt = DateTimeOffset.UtcNow };
        dbContext.Friendships.Add(friendship);
        dbContext.Notifications.Add(new Notification { Id = Guid.NewGuid(), UserId = userId, Type = "friend.request", Title = "New friend request", ReferenceId = friendship.Id.ToString(), CreatedAt = DateTimeOffset.UtcNow });
        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(friendship));
    }

    [HttpPut("{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (friendship is null || friendship.AddresseeId != userId)
        {
            return NotFound(new ApiResponse<object>(new { message = "Friend request not found" }));
        }
        if (friendship.Status != "pending")
        {
            return Conflict(new ApiResponse<object>(new { message = "Friend request is not pending" }));
        }
        friendship.Status = "accepted";
        await dbContext.SaveChangesAsync(cancellationToken);
        // Intel mirrors this into `intel.FriendEdges` to light up the
        // "friends liked this" recommendation signal.
        await kafkaProducerService.PublishAsync("friend.accepted", new { friendship.Id, friendship.RequesterId, friendship.AddresseeId }, cancellationToken);
        return Ok(new ApiResponse<object>(friendship));
    }

    /// <summary>
    /// Reject a pending friend request. Only the addressee can reject. Emits
    /// `friend.rejected` so Intel can remove any edge it might have cached.
    /// </summary>
    [HttpPut("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (friendship is null || friendship.AddresseeId != userId)
        {
            return NotFound(new ApiResponse<object>(new { message = "Friend request not found" }));
        }
        if (friendship.Status != "pending")
        {
            return Conflict(new ApiResponse<object>(new { message = "Friend request is not pending" }));
        }
        dbContext.Friendships.Remove(friendship);
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("friend.rejected", new { friendship.Id, friendship.RequesterId, friendship.AddresseeId }, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Remove an existing (accepted) friendship. Either party can initiate.
    /// Emits `friend.removed` so Intel drops the corresponding edges.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (friendship is null || (friendship.RequesterId != userId && friendship.AddresseeId != userId))
        {
            return NotFound(new ApiResponse<object>(new { message = "Friendship not found" }));
        }
        dbContext.Friendships.Remove(friendship);
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("friend.removed", new { friendship.Id, friendship.RequesterId, friendship.AddresseeId }, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Accepted friendships involving the caller. Each row includes the
    /// counter-party's public profile so the frontend can render without a
    /// follow-up lookup.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        var baseQuery = dbContext.Friendships
            .AsNoTracking()
            .Where(x => x.Status == "accepted" && (x.RequesterId == userId || x.AddresseeId == userId));

        var total = await baseQuery.CountAsync(cancellationToken);
        var rows = await baseQuery
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var otherIds = rows.Select(x => x.RequesterId == userId ? x.AddresseeId : x.RequesterId).Distinct().ToList();
        var users = await dbContext.Users
            .AsNoTracking()
            .Where(x => otherIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Username, x.DisplayName, x.AvatarUrl })
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var items = rows.Select(x =>
        {
            var otherId = x.RequesterId == userId ? x.AddresseeId : x.RequesterId;
            users.TryGetValue(otherId, out var profile);
            return new
            {
                friendshipId = x.Id,
                friendId = otherId,
                username = profile?.Username,
                displayName = profile?.DisplayName,
                avatarUrl = profile?.AvatarUrl,
                since = x.CreatedAt,
            };
        });

        return Ok(new ApiResponse<object>(items, new { page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) }));
    }

    /// <summary>
    /// Pending friend requests addressed to the caller (i.e. inbox).
    /// </summary>
    [HttpGet("pending")]
    public async Task<IActionResult> Pending(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var rows = await dbContext.Friendships
            .AsNoTracking()
            .Where(x => x.Status == "pending" && x.AddresseeId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var requesterIds = rows.Select(x => x.RequesterId).Distinct().ToList();
        var users = await dbContext.Users
            .AsNoTracking()
            .Where(x => requesterIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Username, x.DisplayName, x.AvatarUrl })
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var items = rows.Select(x =>
        {
            users.TryGetValue(x.RequesterId, out var profile);
            return new
            {
                friendshipId = x.Id,
                requesterId = x.RequesterId,
                username = profile?.Username,
                displayName = profile?.DisplayName,
                avatarUrl = profile?.AvatarUrl,
                requestedAt = x.CreatedAt,
            };
        });

        return Ok(new ApiResponse<object>(items));
    }
}
