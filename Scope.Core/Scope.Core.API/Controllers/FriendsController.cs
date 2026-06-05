using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize]
[Route("api/core/friends")]
public sealed class FriendsController(
    CoreDbContext dbContext,
    IKafkaProducerService kafkaProducerService,
    INotificationService? notificationService = null) : ControllerBase
{
    private static readonly TimeSpan PlanningWindow = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(5);
    private const string FriendshipStatusPending = "pending";
    private const string FriendshipStatusAccepted = "accepted";
    private const string FriendRequestNotificationType = "friend.request";
    private const string FriendAcceptedNotificationType = "friend.accepted";

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
        var friendship = new Friendship { Id = Guid.NewGuid(), RequesterId = requesterId, AddresseeId = userId, Status = FriendshipStatusPending, CreatedAt = DateTimeOffset.UtcNow };
        dbContext.Friendships.Add(friendship);
        await dbContext.SaveChangesAsync(cancellationToken);
        if (notificationService is not null)
        {
            var requester = await GetUserProjectionAsync(requesterId, includeEmail: false, cancellationToken);
            await notificationService.CreateAsync(new NotificationCreateRequest(
                userId,
                FriendRequestNotificationType,
                FriendRequestNotificationType,
                "friend",
                "urgent",
                "New friend request",
                $"{requester?.DisplayName ?? "Someone"} wants to connect on Scope.",
                "/friends?tab=requests",
                requesterId,
                "friendship",
                friendship.Id.ToString(),
                $"{FriendRequestNotificationType}:{friendship.Id:N}",
                null,
                null,
                friendship.CreatedAt), cancellationToken);
        }
        else
        {
            dbContext.Notifications.Add(new Notification { Id = Guid.NewGuid(), UserId = userId, Type = FriendRequestNotificationType, Title = "New friend request", ReferenceId = friendship.Id.ToString(), CreatedAt = DateTimeOffset.UtcNow });
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(new
        {
            friendshipId = friendship.Id,
            friendId = userId,
            status = friendship.Status,
            requestedAt = friendship.CreatedAt,
        }));
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
        if (friendship.Status != FriendshipStatusPending)
        {
            return Conflict(new ApiResponse<object>(new { message = "Friend request is not pending" }));
        }
        friendship.Status = FriendshipStatusAccepted;
        if (notificationService is not null)
        {
            var addressee = await GetUserProjectionAsync(friendship.AddresseeId, includeEmail: false, cancellationToken);
            await notificationService.CreateAsync(new NotificationCreateRequest(
                friendship.RequesterId,
                FriendAcceptedNotificationType,
                FriendAcceptedNotificationType,
                "friend",
                "normal",
                "Friend request accepted",
                $"{addressee?.DisplayName ?? "Someone"} accepted your Scope friend request.",
                $"/profile/{friendship.AddresseeId}",
                friendship.AddresseeId,
                "friendship",
                friendship.Id.ToString(),
                $"{FriendAcceptedNotificationType}:{friendship.Id:N}",
                null,
                null,
                DateTimeOffset.UtcNow), cancellationToken);
        }
        else
        {
            dbContext.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = friendship.RequesterId,
                Type = FriendAcceptedNotificationType,
                Title = "Friend request accepted",
                ReferenceId = friendship.Id.ToString(),
                CreatedAt = DateTimeOffset.UtcNow,
            });
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync(FriendAcceptedNotificationType, new { friendship.Id, friendship.RequesterId, friendship.AddresseeId }, cancellationToken);
        return Ok(new ApiResponse<object>(await BuildConnectionPayloadAsync(friendship, userId, cancellationToken)));
    }

    [HttpPut("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (friendship is null || friendship.AddresseeId != userId)
        {
            return NotFound(new ApiResponse<object>(new { message = "Friend request not found" }));
        }
        if (friendship.Status != FriendshipStatusPending)
        {
            return Conflict(new ApiResponse<object>(new { message = "Friend request is not pending" }));
        }
        dbContext.Friendships.Remove(friendship);
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("friend.rejected", new { friendship.Id, friendship.RequesterId, friendship.AddresseeId }, cancellationToken);
        return NoContent();
    }

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

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        var pagination = Pagination.Normalize(page, pageSize, defaultPageSize: 50, maxPageSize: 200);

        var baseQuery = dbContext.Friendships
            .AsNoTracking()
            .Where(x => x.Status == FriendshipStatusAccepted && (x.RequesterId == userId || x.AddresseeId == userId));

        var total = await baseQuery.CountAsync(cancellationToken);
        var rows = await baseQuery
            .OrderByDescending(x => x.CreatedAt)
            .Skip(pagination.Offset)
            .Take(pagination.PageSize)
            .ToListAsync(cancellationToken);

        var items = new List<object>();
        foreach (var friendship in rows)
        {
            items.Add(await BuildConnectionPayloadAsync(friendship, userId, cancellationToken));
        }

        return Ok(new ApiResponse<object>(items, pagination.ToMetadata(total)));
    }

    [HttpGet("pending")]
    public async Task<IActionResult> Pending(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var rows = await dbContext.Friendships
            .AsNoTracking()
            .Where(x => x.Status == FriendshipStatusPending && x.AddresseeId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);

        var items = new List<object>();
        foreach (var friendship in rows)
        {
            var user = await GetUserProjectionAsync(friendship.RequesterId, includeEmail: false, cancellationToken);
            var mutualFriends = await CountMutualFriendsAsync(userId, friendship.RequesterId, cancellationToken);
            items.Add(new
            {
                id = friendship.Id,
                friendshipId = friendship.Id,
                requesterId = friendship.RequesterId,
                direction = "incoming",
                user = ToUserPayload(user),
                mutualFriends,
                requestedAt = friendship.CreatedAt,
                createdAt = friendship.CreatedAt,
                note = BuildRequestNote(user, mutualFriends),
            });
        }

        return Ok(new ApiResponse<object>(items));
    }

    [HttpGet("suggestions")]
    public async Task<IActionResult> Suggestions([FromQuery] string mode = "best", [FromQuery] int limit = 8, CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        limit = Math.Clamp(limit, 1, 24);
        var normalizedMode = string.IsNullOrWhiteSpace(mode) ? "best" : mode.Trim().ToLowerInvariant();
        var currentUser = await GetUserProjectionAsync(userId, includeEmail: true, cancellationToken);
        var currentInterests = ParseInterests(currentUser?.InterestsJson).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var currentFriendIds = await GetAcceptedFriendIdsAsync(userId, cancellationToken);
        var linkedUserIds = await dbContext.Friendships
            .AsNoTracking()
            .Where(x => x.RequesterId == userId || x.AddresseeId == userId)
            .Select(x => x.RequesterId == userId ? x.AddresseeId : x.RequesterId)
            .ToListAsync(cancellationToken);

        var excludedIds = linkedUserIds.Append(userId).ToHashSet();
        var candidates = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.IsActive && !x.IsShowcase && !excludedIds.Contains(x.Id))
            .OrderByDescending(x => x.CreatedAt)
            .Take(200)
            .Select(x => new UserProjection(x.Id, x.Username, string.Empty, x.DisplayName, x.Bio, x.AvatarUrl, x.HomeBase, x.InterestsJson, x.ShowActivityStatus, x.CreatedAt))
            .ToListAsync(cancellationToken);

        var suggestions = new List<SuggestionCandidate>();
        foreach (var candidate in candidates)
        {
            var candidateInterests = ParseInterests(candidate.InterestsJson);
            var sharedInterests = candidateInterests.Where(currentInterests.Contains).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            var mutualFriends = await CountMutualFriendsAsync(userId, candidate.Id, currentFriendIds, cancellationToken);
            var sameHomeBase = !string.IsNullOrWhiteSpace(currentUser?.HomeBase)
                && string.Equals(currentUser.HomeBase, candidate.HomeBase, StringComparison.OrdinalIgnoreCase);
            var presence = await GetPresenceProjectionAsync(candidate.Id, cancellationToken);
            var score = (mutualFriends * 12)
                + (sharedInterests.Length * 4)
                + (sameHomeBase ? 5 : 0)
                + (presence?.LastActiveAt > DateTimeOffset.UtcNow.Subtract(OnlineWindow) ? 2 : 0);

            suggestions.Add(new SuggestionCandidate(candidate, mutualFriends, sharedInterests, score, sameHomeBase, presence));
        }

        IEnumerable<SuggestionCandidate> ordered = normalizedMode switch
        {
            "random" => suggestions.OrderBy(_ => Guid.NewGuid()),
            "mutuals" => suggestions.OrderByDescending(x => x.MutualFriends).ThenByDescending(x => x.Score),
            "vibes" => suggestions.OrderByDescending(x => x.SharedInterests.Length).ThenByDescending(x => x.Score),
            _ => suggestions.OrderByDescending(x => x.Score).ThenByDescending(x => x.User.CreatedAt),
        };

        return Ok(new ApiResponse<object>(ordered.Take(limit).Select(ToSuggestionPayload)));
    }

    private async Task<object> BuildConnectionPayloadAsync(Friendship friendship, Guid currentUserId, CancellationToken cancellationToken)
    {
        var friendId = friendship.RequesterId == currentUserId ? friendship.AddresseeId : friendship.RequesterId;
        var user = await GetUserProjectionAsync(friendId, includeEmail: false, cancellationToken);
        var presence = await GetPresenceProjectionAsync(friendId, cancellationToken);
        var mutualFriends = await CountMutualFriendsAsync(currentUserId, friendId, cancellationToken);
        var favoriteCategories = ParseInterests(user?.InterestsJson).Take(4).ToArray();
        return new
        {
            id = friendship.Id,
            friendshipId = friendship.Id,
            friendId,
            user = ToUserPayload(user),
            presence = ResolvePresence(user, presence),
            sharedTrips = 0,
            mutualFriends,
            favoriteCategories,
            nextAdventure = BuildNextAdventure(user),
            lastActiveAt = presence?.LastActiveAt ?? friendship.CreatedAt,
            since = friendship.CreatedAt,
        };
    }

    private object ToSuggestionPayload(SuggestionCandidate candidate) => new
    {
        id = candidate.User.Id,
        user = ToUserPayload(candidate.User),
        mutualFriends = candidate.MutualFriends,
        sharedInterests = candidate.SharedInterests,
        favoriteCategories = ParseInterests(candidate.User.InterestsJson).Take(4).ToArray(),
        presence = ResolvePresence(candidate.User, candidate.Presence),
        reason = BuildSuggestionReason(candidate),
        score = candidate.Score,
    };

    private async Task<UserProjection?> GetUserProjectionAsync(Guid userId, bool includeEmail, CancellationToken cancellationToken)
        => await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == userId && x.IsActive)
            .Select(x => new UserProjection(x.Id, x.Username, includeEmail ? x.Email : string.Empty, x.DisplayName, x.Bio, x.AvatarUrl, x.HomeBase, x.InterestsJson, x.ShowActivityStatus, x.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);

    private async Task<PresenceProjection?> GetPresenceProjectionAsync(Guid userId, CancellationToken cancellationToken)
        => await dbContext.UserPresences
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => new PresenceProjection(x.UserId, x.Status, x.RouteContext, x.IsIdle, x.LastActiveAt, x.LastPlanningAt, x.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);

    private async Task<HashSet<Guid>> GetAcceptedFriendIdsAsync(Guid userId, CancellationToken cancellationToken)
        => (await dbContext.Friendships
            .AsNoTracking()
            .Where(x => x.Status == FriendshipStatusAccepted && (x.RequesterId == userId || x.AddresseeId == userId))
            .Select(x => x.RequesterId == userId ? x.AddresseeId : x.RequesterId)
            .ToListAsync(cancellationToken))
            .ToHashSet();

    private async Task<int> CountMutualFriendsAsync(Guid currentUserId, Guid otherUserId, CancellationToken cancellationToken)
        => await CountMutualFriendsAsync(currentUserId, otherUserId, await GetAcceptedFriendIdsAsync(currentUserId, cancellationToken), cancellationToken);

    private async Task<int> CountMutualFriendsAsync(Guid currentUserId, Guid otherUserId, HashSet<Guid> currentFriendIds, CancellationToken cancellationToken)
    {
        if (currentUserId == otherUserId || currentFriendIds.Count == 0)
        {
            return 0;
        }

        var otherFriendIds = await GetAcceptedFriendIdsAsync(otherUserId, cancellationToken);
        return otherFriendIds.Count(currentFriendIds.Contains);
    }

    private static object ToUserPayload(UserProjection? user) => new
    {
        id = user?.Id ?? Guid.Empty,
        username = user?.Username ?? "scope-user",
        email = user?.Email ?? string.Empty,
        displayName = user?.DisplayName ?? "Scope traveler",
        bio = user?.Bio,
        avatarUrl = user?.AvatarUrl,
        homeBase = user?.HomeBase,
        interests = ParseInterests(user?.InterestsJson),
        stats = new { spots = 0, trips = 0, friends = 0 },
        showActivityStatus = user?.ShowActivityStatus ?? true,
    };

    private static string ResolvePresence(UserProjection? user, PresenceProjection? presence)
    {
        if (user?.ShowActivityStatus == false)
        {
            return "hidden";
        }

        if (presence is null)
        {
            return "offline";
        }

        var now = DateTimeOffset.UtcNow;
        if (presence.LastActiveAt < now.Subtract(OnlineWindow))
        {
            return "offline";
        }

        if (presence.IsIdle || string.Equals(presence.Status, "idle", StringComparison.OrdinalIgnoreCase))
        {
            return "idle";
        }

        if (presence.LastPlanningAt is not null && presence.LastPlanningAt >= now.Subtract(PlanningWindow))
        {
            return "planning";
        }

        return "online";
    }

    private static string BuildNextAdventure(UserProjection? user)
    {
        var interests = ParseInterests(user?.InterestsJson);
        var topInterest = interests.FirstOrDefault();
        var homeBase = string.IsNullOrWhiteSpace(user?.HomeBase) ? "their next city" : user!.HomeBase;
        return string.IsNullOrWhiteSpace(topInterest)
            ? $"Mapping fresh routes around {homeBase}"
            : $"{homeBase} {topInterest} route";
    }

    private static string BuildRequestNote(UserProjection? user, int mutualFriends)
    {
        var overlap = mutualFriends > 0 ? $"{mutualFriends} mutual friend{(mutualFriends == 1 ? "" : "s")} and " : string.Empty;
        var interests = ParseInterests(user?.InterestsJson);
        return interests.Count > 0
            ? $"Matched through {overlap}{string.Join(", ", interests.Take(2))} travel vibes."
            : $"Matched through {overlap}Scope travel activity.";
    }

    private static string BuildSuggestionReason(SuggestionCandidate candidate)
    {
        if (candidate.MutualFriends > 0)
        {
            return $"{candidate.MutualFriends} mutual friend{(candidate.MutualFriends == 1 ? "" : "s")}";
        }

        if (candidate.SharedInterests.Length > 0)
        {
            return $"Shared {string.Join(", ", candidate.SharedInterests.Take(2))} vibe";
        }

        return candidate.SameHomeBase ? "Same home base" : "Fresh Scope traveler";
    }

    private static IReadOnlyList<string> ParseInterests(string? interestsJson)
    {
        if (string.IsNullOrWhiteSpace(interestsJson))
        {
            return Array.Empty<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<string[]>(interestsJson) ?? Array.Empty<string>();
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }

    private sealed record UserProjection(
        Guid Id,
        string Username,
        string Email,
        string DisplayName,
        string? Bio,
        string? AvatarUrl,
        string? HomeBase,
        string? InterestsJson,
        bool ShowActivityStatus,
        DateTimeOffset CreatedAt);

    private sealed record PresenceProjection(
        Guid UserId,
        string Status,
        string? RouteContext,
        bool IsIdle,
        DateTimeOffset LastActiveAt,
        DateTimeOffset? LastPlanningAt,
        DateTimeOffset UpdatedAt);

    private sealed record SuggestionCandidate(
        UserProjection User,
        int MutualFriends,
        string[] SharedInterests,
        int Score,
        bool SameHomeBase,
        PresenceProjection? Presence);
}
