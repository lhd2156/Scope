using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Infrastructure;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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
        var canSeeEmail = id == callerId || User.IsInRole("admin");
        var user = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == id && x.IsActive)
            .Select(x => new UserProjection(x.Id, x.Username, canSeeEmail ? x.Email : string.Empty, x.DisplayName, x.Bio, x.AvatarUrl, x.HomeBase, x.InterestsJson, x.ShowActivityStatus, x.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        return user is null
            ? NotFound(new ApiResponse<object>(new { message = "User not found" }))
            : Ok(new ApiResponse<object>(ToProfilePayload(user)));
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
            user.CreatedAt,
            user.UpdatedAt,
        }));
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

        var isExactEmailSearch = query.Contains('@', StringComparison.Ordinal) && query.Count(x => x == '@') == 1;
        var loweredQuery = query.ToLowerInvariant();
        var baseQuery = dbContext.Users
            .AsNoTracking()
            .Where(x => x.IsActive)
            .Where(x => isExactEmailSearch
                ? x.Email == loweredQuery
                : x.Username.Contains(query) || x.DisplayName.Contains(query) || (x.HomeBase != null && x.HomeBase.Contains(query)));

        var total = await baseQuery.CountAsync(cancellationToken);
        var users = await baseQuery
            .OrderBy(x => x.DisplayName)
            .Skip(pagination.Offset)
            .Take(pagination.PageSize)
            .Select(x => new UserProjection(x.Id, x.Username, string.Empty, x.DisplayName, x.Bio, x.AvatarUrl, x.HomeBase, x.InterestsJson, x.ShowActivityStatus, x.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(new ApiResponse<object>(
            users.Select(ToProfilePayload),
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
        DateTimeOffset CreatedAt);

    private static object ToProfilePayload(UserProjection user) => new
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
        Stats = new { spots = 0, trips = 0, friends = 0 },
        user.CreatedAt,
    };

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
