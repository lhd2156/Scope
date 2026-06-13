using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.Json;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting("global")]
[Route("api/core/users")]
public sealed class UsersController(CoreDbContext dbContext) : ControllerBase
{
    private const int MaxInterestCount = 12;
    private const int MaxInterestLength = 32;

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var callerId = User.GetRequiredUserId();
        var isOwnerOrAdmin = id == callerId || User.IsInRole("admin");
        var user = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == id && x.IsActive)
            .Select(x => new UserProjection(
                x.Id,
                x.Username,
                isOwnerOrAdmin ? x.Email : string.Empty,
                x.DisplayName,
                x.Bio,
                x.AvatarUrl,
                x.HomeBase,
                x.InterestsJson,
                x.ShowActivityStatus,
                x.ProfileVisibility,
                x.IsShowcase,
                x.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "User not found" }));
        }

        var isAcceptedFriend = !isOwnerOrAdmin
            && await IsAcceptedFriendAsync(callerId, id, cancellationToken);
        var canSeePlanningContext = ProfileVisibilityPolicy.CanSeePlanningContext(
            user.ProfileVisibility,
            isOwnerOrAdmin,
            isAcceptedFriend,
            user.IsShowcase);

        return Ok(new ApiResponse<object>(ToProfilePayload(
            user,
            canSeePlanningContext,
            canSeeExactHomeBase: isOwnerOrAdmin)));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UserProfileUpdateRequest request, CancellationToken cancellationToken)
    {
        var callerId = User.GetRequiredUserId();
        if (id != callerId && !User.IsInRole("admin"))
        {
            return Forbid();
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id && x.IsActive, cancellationToken);
        if (user is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "User not found" }));
        }

        if (request.DisplayName is not null)
        {
            var displayName = request.DisplayName.Trim();
            if (displayName.Length < 2)
            {
                return BadRequest(new ApiResponse<object>(new { message = "Display name must be at least 2 characters" }));
            }
            user.DisplayName = displayName;
        }
        if (request.Bio is not null)
        {
            user.Bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim();
        }
        if (request.AvatarUrl is not null)
        {
            user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        }
        if (request.HomeBase is not null)
        {
            user.HomeBase = string.IsNullOrWhiteSpace(request.HomeBase) ? null : request.HomeBase.Trim();
        }
        if (request.Interests is not null)
        {
            user.InterestsJson = SerializeInterests(request.Interests);
        }
        if (request.ShowActivityStatus is not null)
        {
            user.ShowActivityStatus = request.ShowActivityStatus.Value;
        }
        if (request.ProfileVisibility is not null)
        {
            var profileVisibility = request.ProfileVisibility.Trim().ToLowerInvariant();
            if (!ProfileVisibilityPolicy.IsValid(profileVisibility))
            {
                return BadRequest(new ApiResponse<object>(new { message = "Profile visibility must be public, friends, or private" }));
            }
            user.ProfileVisibility = profileVisibility;
        }
        user.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(new
        {
            user.Id,
            user.Username,
            user.Email,
            user.DisplayName,
            user.Bio,
            user.AvatarUrl,
            user.HomeBase,
            Interests = ParseInterests(user.InterestsJson),
            user.ShowActivityStatus,
            user.ProfileVisibility,
            user.CreatedAt,
            user.UpdatedAt,
        }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var callerId = User.GetRequiredUserId();
        if (id != callerId && !User.IsInRole("admin"))
        {
            return Forbid();
        }

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id && x.IsActive, cancellationToken);
        if (user is null)
        {
            return NotFound(new ApiResponse<object>(new { message = "User not found" }));
        }

        var notifications = await dbContext.Notifications
            .Where(x => x.UserId == id || x.ActorUserId == id)
            .ToListAsync(cancellationToken);
        var notificationDeliveries = await dbContext.NotificationDeliveries
            .Where(delivery => dbContext.Notifications
                .Where(notification => notification.UserId == id || notification.ActorUserId == id)
                .Select(notification => notification.Id)
                .Contains(delivery.NotificationId))
            .ToListAsync(cancellationToken);

        dbContext.NotificationDeliveries.RemoveRange(notificationDeliveries);
        dbContext.Notifications.RemoveRange(notifications);
        dbContext.NotificationPreferences.RemoveRange(
            dbContext.NotificationPreferences.Where(x => x.UserId == id));
        dbContext.PushSubscriptions.RemoveRange(
            dbContext.PushSubscriptions.Where(x => x.UserId == id));
        dbContext.Friendships.RemoveRange(
            dbContext.Friendships.Where(x => x.RequesterId == id || x.AddresseeId == id));
        dbContext.UserBlocks.RemoveRange(
            dbContext.UserBlocks.Where(x => x.BlockerId == id || x.BlockedId == id));
        dbContext.LiveSessions.RemoveRange(
            dbContext.LiveSessions.Where(x => x.UserId == id));
        dbContext.UserPresences.RemoveRange(
            dbContext.UserPresences.Where(x => x.UserId == id));
        dbContext.RefreshTokens.RemoveRange(
            dbContext.RefreshTokens.Where(x => x.UserId == id));
        dbContext.PasswordResets.RemoveRange(
            dbContext.PasswordResets.Where(x => x.UserId == id));
        dbContext.UserReports.RemoveRange(
            dbContext.UserReports.Where(x => x.ReporterId == id));

        var reportsTargetingUser = await dbContext.UserReports
            .Where(x => x.TargetUserId == id && x.ReporterId != id)
            .ToListAsync(cancellationToken);
        foreach (var report in reportsTargetingUser)
        {
            report.TargetUserId = null;
        }

        var tombstone = id.ToString("N");
        user.Username = $"deleted-{tombstone[..22]}";
        user.Email = $"deleted+{tombstone}@invalid.scopetrips.local";
        user.PhoneNumber = null;
        user.PasswordHash = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        user.DisplayName = "Deleted traveler";
        user.DateOfBirth = null;
        user.Bio = null;
        user.AvatarUrl = null;
        user.HomeBase = null;
        user.InterestsJson = null;
        user.ShowActivityStatus = false;
        user.ProfileVisibility = ProfileVisibilityPolicy.Private;
        user.IsShowcase = false;
        user.Role = "user";
        user.IsActive = false;
        user.LastLoginAt = null;
        user.FailedLoginAttempts = 0;
        user.LockoutUntil = null;
        user.EmailVerifiedAt = null;
        user.EmailVerificationTokenHash = null;
        user.EmailVerificationSentAt = null;
        user.MfaEnabled = false;
        user.MfaSecret = null;
        user.MfaRecoveryCodesHash = null;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/stats")]
    public async Task<IActionResult> Stats(Guid id, CancellationToken cancellationToken)
    {
        var userExists = await dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == id && x.IsActive, cancellationToken);
        if (!userExists)
        {
            return NotFound(new ApiResponse<object>(new { message = "User not found" }));
        }

        var callerId = User.GetRequiredUserId();
        var canSeePrivateCounts = id == callerId || User.IsInRole("admin");
        var friendsCount = await dbContext.Friendships
            .AsNoTracking()
            .CountAsync(x => x.Status == "accepted" && (x.RequesterId == id || x.AddresseeId == id), cancellationToken);

        int? pendingFriendRequests = null;
        int? unreadNotifications = null;
        int? activeLiveSessions = null;
        if (canSeePrivateCounts)
        {
            pendingFriendRequests = await dbContext.Friendships
                .AsNoTracking()
                .CountAsync(x => x.Status == "pending" && x.AddresseeId == id, cancellationToken);
            unreadNotifications = await dbContext.Notifications
                .AsNoTracking()
                .CountAsync(x => x.UserId == id && !x.IsRead, cancellationToken);
            activeLiveSessions = await dbContext.LiveSessions
                .AsNoTracking()
                .CountAsync(x => x.UserId == id && x.IsActive, cancellationToken);
        }

        return Ok(new ApiResponse<object>(new
        {
            friendsCount,
            friends = friendsCount,
            spots = 0,
            trips = 0,
            pendingFriendRequests,
            unreadNotifications,
            activeLiveSessions,
        }));
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = NormalizeSearchQuery(q);
        if (query.Length < 2)
        {
            return Ok(new ApiResponse<object>(Array.Empty<object>()));
        }

        var pagination = Pagination.Normalize(page, pageSize, defaultPageSize: 20, maxPageSize: 50);

        var callerId = User.GetRequiredUserId();
        var isAdmin = User.IsInRole("admin");
        var acceptedFriendIds = isAdmin
            ? []
            : await GetAcceptedFriendIdsAsync(callerId, cancellationToken);
        var isExactEmailSearch = query.Contains('@', StringComparison.Ordinal) && query.Count(x => x == '@') == 1;
        var loweredQuery = query.ToLowerInvariant();
        var baseQuery = dbContext.Users
            .AsNoTracking()
            .Where(x => x.IsActive && !x.IsShowcase)
            .Where(x => isAdmin
                || x.Id == callerId
                || x.ProfileVisibility != ProfileVisibilityPolicy.Private
                || acceptedFriendIds.Contains(x.Id))
            .Where(x => isExactEmailSearch
                ? x.Email == loweredQuery
                : x.Username.Contains(query)
                    || x.DisplayName.Contains(query)
                    || ((isAdmin
                            || x.Id == callerId
                            || acceptedFriendIds.Contains(x.Id))
                        && x.HomeBase != null
                        && x.HomeBase.Contains(query)));

        var total = await baseQuery.CountAsync(cancellationToken);
        var users = await baseQuery
            .OrderBy(x => x.DisplayName)
            .Skip(pagination.Offset)
            .Take(pagination.PageSize)
            .Select(x => new UserProjection(
                x.Id,
                x.Username,
                isAdmin || x.Id == callerId ? x.Email : string.Empty,
                x.DisplayName,
                x.Bio,
                x.AvatarUrl,
                x.HomeBase,
                x.InterestsJson,
                x.ShowActivityStatus,
                x.ProfileVisibility,
                x.IsShowcase,
                x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiResponse<object>(
            users.Select(user =>
            {
                var isOwnerOrAdmin = isAdmin || user.Id == callerId;
                var canSeePlanningContext = ProfileVisibilityPolicy.CanSeePlanningContext(
                    user.ProfileVisibility,
                    isOwnerOrAdmin,
                    acceptedFriendIds.Contains(user.Id),
                    user.IsShowcase);
                return ToProfilePayload(user, canSeePlanningContext, canSeeExactHomeBase: isOwnerOrAdmin);
            }),
            pagination.ToMetadata(total)));
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
        string ProfileVisibility,
        bool IsShowcase,
        DateTimeOffset CreatedAt);

    private static object ToProfilePayload(
        UserProjection user,
        bool includePlanningContext,
        bool canSeeExactHomeBase) => new
    {
        user.Id,
        user.Username,
        user.Email,
        user.DisplayName,
        Bio = includePlanningContext ? user.Bio : null,
        user.AvatarUrl,
        HomeBase = includePlanningContext
            ? canSeeExactHomeBase
                ? user.HomeBase
                : ProfileVisibilityPolicy.ToPublicHomeBase(user.HomeBase)
            : null,
        Interests = includePlanningContext ? ParseInterests(user.InterestsJson) : Array.Empty<string>(),
        ShowActivityStatus = includePlanningContext && user.ShowActivityStatus,
        ProfileVisibility = ProfileVisibilityPolicy.Normalize(user.ProfileVisibility),
        Stats = new { spots = 0, trips = 0, friends = 0 },
        user.CreatedAt,
    };

    private async Task<bool> IsAcceptedFriendAsync(Guid callerId, Guid otherUserId, CancellationToken cancellationToken)
        => await dbContext.Friendships
            .AsNoTracking()
            .AnyAsync(
                x => x.Status == "accepted"
                    && ((x.RequesterId == callerId && x.AddresseeId == otherUserId)
                        || (x.RequesterId == otherUserId && x.AddresseeId == callerId)),
                cancellationToken);

    private async Task<List<Guid>> GetAcceptedFriendIdsAsync(Guid userId, CancellationToken cancellationToken)
        => await dbContext.Friendships
            .AsNoTracking()
            .Where(x => x.Status == "accepted" && (x.RequesterId == userId || x.AddresseeId == userId))
            .Select(x => x.RequesterId == userId ? x.AddresseeId : x.RequesterId)
            .ToListAsync(cancellationToken);

    private static string NormalizeSearchQuery(string? value)
    {
        var query = (value ?? string.Empty).Trim();
        return query.StartsWith("@", StringComparison.Ordinal) ? query[1..].Trim() : query;
    }

    private static string SerializeInterests(IEnumerable<string> interests)
    {
        var sanitized = interests
            .Select(x => (x ?? string.Empty).Trim())
            .Where(x => x.Length > 0)
            .Select(x => x.Length > MaxInterestLength ? x[..MaxInterestLength] : x)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(MaxInterestCount)
            .ToArray();

        return JsonSerializer.Serialize(sanitized);
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
}
