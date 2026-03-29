using System.Security.Claims;
using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Core.API.Controllers;

[ApiController]
[Route("api/core/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
        => StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(await authService.RegisterAsync(request.Username, request.Email, request.Password, request.DisplayName, cancellationToken)));

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.LoginAsync(request.Email, request.Password, cancellationToken)));

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.RefreshAsync(request.RefreshToken, cancellationToken)));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request, CancellationToken cancellationToken)
    {
        await authService.LogoutAsync(request.RefreshToken, cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        await authService.ForgotPasswordAsync(request.Email, cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await authService.ResetPasswordAsync(request.Token, request.Password, cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpPost("oauth/cognito")]
    public async Task<IActionResult> Cognito([FromBody] CognitoLoginRequest request, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.LoginWithCognitoAsync(request.Email, request.Username, request.DisplayName, request.Subject, cancellationToken)));

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.GetCurrentUserAsync(User.GetRequiredUserId(), cancellationToken)));
}

[ApiController]
[Authorize]
[Route("api/core/users")]
public sealed class UsersController(
    CoreDbContext dbContext,
    IKafkaProducerService kafkaProducerService,
    IAvatarStorageService avatarStorageService) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.AsNoTracking()
                       .Where(x => x.Id == id && x.IsActive)
                       .Select(x => new UserProfile(x.Id, x.Username, x.Email, x.DisplayName, x.Bio, x.AvatarUrl, x.CreatedAt))
                       .FirstOrDefaultAsync(cancellationToken)
                   ?? throw new NotFoundException("User not found");

        return Ok(new ApiResponse<object>(user));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        EnsureSelf(id, User.GetRequiredUserId());

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id && x.IsActive, cancellationToken)
                   ?? throw new NotFoundException("User not found");

        user.DisplayName = request.DisplayName.Trim();
        user.Bio = request.Bio?.Trim();
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync(KafkaTopics.UserUpdated, new { user.Id, user.Username, user.DisplayName, user.Bio, user.AvatarUrl }, cancellationToken);

        return Ok(new ApiResponse<object>(new UserProfile(user.Id, user.Username, user.Email, user.DisplayName, user.Bio, user.AvatarUrl, user.CreatedAt)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        EnsureSelf(id, User.GetRequiredUserId());

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id && x.IsActive, cancellationToken)
                   ?? throw new NotFoundException("User not found");

        user.IsActive = false;
        user.UpdatedAt = DateTimeOffset.UtcNow;

        var refreshTokens = await dbContext.RefreshTokens.Where(x => x.UserId == id && x.RevokedAt == null).ToListAsync(cancellationToken);
        foreach (var refreshToken in refreshTokens)
        {
            refreshToken.RevokedAt = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(new ApiResponse<object>(Array.Empty<object>()));
        }

        var query = q.Trim();
        var users = await dbContext.Users.AsNoTracking()
            .Where(x => x.IsActive && (x.Username.Contains(query) || x.DisplayName.Contains(query)))
            .OrderBy(x => x.DisplayName)
            .Take(CoreLimits.UserSearchResultCount)
            .Select(x => new { x.Id, x.Username, x.DisplayName, x.AvatarUrl })
            .ToListAsync(cancellationToken);

        return Ok(new ApiResponse<object>(users));
    }

    [HttpPut("{id:guid}/avatar")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(CoreLimits.AvatarUploadBytes)]
    public async Task<IActionResult> Avatar(Guid id, [FromForm] AvatarUploadRequest request, CancellationToken cancellationToken)
    {
        EnsureSelf(id, User.GetRequiredUserId());

        var user = await dbContext.Users.FirstOrDefaultAsync(x => x.Id == id && x.IsActive, cancellationToken)
                   ?? throw new NotFoundException("User not found");

        var file = request.File;
        if (file is null || file.Length == 0)
        {
            throw new ValidationException("Avatar is required", [("file", "Upload a non-empty file")]);
        }

        if (file.Length > CoreLimits.AvatarUploadBytes)
        {
            throw new ValidationException("Avatar exceeds the 10 MB limit", [("file", "File size must be 10 MB or less")]);
        }

        await using var stream = file.OpenReadStream();
        var avatarUrl = await avatarStorageService.SaveAvatarAsync(user.Id, file.FileName, file.ContentType, stream, cancellationToken);
        user.AvatarUrl = avatarUrl;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync(KafkaTopics.UserUpdated, new { user.Id, user.Username, user.DisplayName, user.Bio, user.AvatarUrl }, cancellationToken);

        return Ok(new ApiResponse<object>(new { user.Id, user.AvatarUrl }));
    }

    [HttpGet("{id:guid}/stats")]
    public async Task<IActionResult> Stats(Guid id, CancellationToken cancellationToken)
    {
        var userExists = await dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == id && x.IsActive, cancellationToken);
        if (!userExists)
        {
            throw new NotFoundException("User not found");
        }

        var friendCount = await dbContext.Friendships.AsNoTracking()
            .CountAsync(x => (x.RequesterId == id || x.AddresseeId == id) && x.Status == FriendshipStatuses.Accepted, cancellationToken);

        return Ok(new ApiResponse<object>(new { userId = id, spots = 0, trips = 0, friends = friendCount }));
    }

    private static void EnsureSelf(Guid routeUserId, Guid currentUserId)
    {
        if (routeUserId != currentUserId)
        {
            throw new ForbiddenException("You can only modify your own profile");
        }
    }
}

[ApiController]
[Authorize]
[Route("api/core/friends")]
public sealed class FriendsController(CoreDbContext dbContext, IKafkaProducerService kafkaProducerService) : ControllerBase
{
    [HttpPost("request/{userId:guid}")]
    public async Task<IActionResult> SendRequest(Guid userId, CancellationToken cancellationToken)
    {
        var requesterId = User.GetRequiredUserId();
        if (requesterId == userId)
        {
            throw new ValidationException("You cannot send a friend request to yourself", [("userId", "Target user must be different from the requester")]);
        }

        var targetExists = await dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == userId && x.IsActive, cancellationToken);
        if (!targetExists)
        {
            throw new NotFoundException("User not found");
        }

        var existing = await dbContext.Friendships.FirstOrDefaultAsync(
            x => (x.RequesterId == requesterId && x.AddresseeId == userId) || (x.RequesterId == userId && x.AddresseeId == requesterId),
            cancellationToken);
        if (existing is not null && existing.Status is FriendshipStatuses.Pending or FriendshipStatuses.Accepted or FriendshipStatuses.Blocked)
        {
            throw new ConflictException("A friendship already exists between these users");
        }

        var friendship = existing ?? new Friendship { Id = Guid.NewGuid(), RequesterId = requesterId, AddresseeId = userId, CreatedAt = DateTimeOffset.UtcNow };
        friendship.RequesterId = requesterId;
        friendship.AddresseeId = userId;
        friendship.Status = FriendshipStatuses.Pending;
        friendship.CreatedAt = DateTimeOffset.UtcNow;

        if (existing is null)
        {
            dbContext.Friendships.Add(friendship);
        }

        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = NotificationTypes.FriendRequest,
            Title = "New friend request",
            Body = "Someone wants to connect with you on Atlas.",
            ReferenceId = friendship.Id.ToString(),
            CreatedAt = DateTimeOffset.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(new { friendship.Id, friendship.RequesterId, friendship.AddresseeId, friendship.Status, friendship.CreatedAt }));
    }

    [HttpPut("{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetRequiredUserId();
        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
                         ?? throw new NotFoundException("Friend request not found");

        if (friendship.AddresseeId != currentUserId)
        {
            throw new ForbiddenException("Only the recipient can accept this friend request");
        }

        if (friendship.Status != FriendshipStatuses.Pending)
        {
            throw new UnprocessableException("Only pending friend requests can be accepted");
        }

        friendship.Status = FriendshipStatuses.Accepted;
        await dbContext.SaveChangesAsync(cancellationToken);

        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = friendship.RequesterId,
            Type = NotificationTypes.FriendAccepted,
            Title = "Friend request accepted",
            Body = "Your Atlas friend request was accepted.",
            ReferenceId = friendship.Id.ToString(),
            CreatedAt = DateTimeOffset.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync(KafkaTopics.FriendAccepted, new { friendship.Id, friendship.RequesterId, friendship.AddresseeId }, cancellationToken);

        return Ok(new ApiResponse<object>(new { friendship.Id, friendship.RequesterId, friendship.AddresseeId, friendship.Status, friendship.CreatedAt }));
    }

    [HttpPut("{id:guid}/decline")]
    public async Task<IActionResult> Decline(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetRequiredUserId();
        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
                         ?? throw new NotFoundException("Friend request not found");

        if (friendship.AddresseeId != currentUserId)
        {
            throw new ForbiddenException("Only the recipient can decline this friend request");
        }

        if (friendship.Status != FriendshipStatuses.Pending)
        {
            throw new UnprocessableException("Only pending friend requests can be declined");
        }

        friendship.Status = FriendshipStatuses.Declined;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiResponse<object>(new { friendship.Id, friendship.RequesterId, friendship.AddresseeId, friendship.Status, friendship.CreatedAt }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetRequiredUserId();
        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(
                             x => x.Id == id && (x.RequesterId == currentUserId || x.AddresseeId == currentUserId),
                             cancellationToken)
                         ?? throw new NotFoundException("Friendship not found");

        dbContext.Friendships.Remove(friendship);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var currentUserId = User.GetRequiredUserId();
        var friendships = await dbContext.Friendships.AsNoTracking()
            .Where(x => x.Status == FriendshipStatuses.Accepted && (x.RequesterId == currentUserId || x.AddresseeId == currentUserId))
            .Select(x => new
            {
                x.Id,
                FriendId = x.RequesterId == currentUserId ? x.AddresseeId : x.RequesterId,
                x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var friendIds = friendships.Select(x => x.FriendId).Distinct().ToList();
        var userLookup = await dbContext.Users.AsNoTracking()
            .Where(x => friendIds.Contains(x.Id) && x.IsActive)
            .ToDictionaryAsync(x => x.Id, x => new { x.Id, x.Username, x.DisplayName, x.AvatarUrl }, cancellationToken);

        var response = friendships
            .Where(x => userLookup.ContainsKey(x.FriendId))
            .Select(x => new { x.Id, Friend = userLookup[x.FriendId], x.CreatedAt })
            .ToList();

        return Ok(new ApiResponse<object>(response));
    }

    [HttpGet("pending")]
    public async Task<IActionResult> Pending(CancellationToken cancellationToken)
    {
        var currentUserId = User.GetRequiredUserId();
        var requests = await dbContext.Friendships.AsNoTracking()
            .Where(x => x.Status == FriendshipStatuses.Pending && x.AddresseeId == currentUserId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.Id, x.RequesterId, x.CreatedAt })
            .ToListAsync(cancellationToken);

        var requesterIds = requests.Select(x => x.RequesterId).Distinct().ToList();
        var requesterLookup = await dbContext.Users.AsNoTracking()
            .Where(x => requesterIds.Contains(x.Id) && x.IsActive)
            .ToDictionaryAsync(x => x.Id, x => new { x.Id, x.Username, x.DisplayName, x.AvatarUrl }, cancellationToken);

        var response = requests
            .Where(x => requesterLookup.ContainsKey(x.RequesterId))
            .Select(x => new { x.Id, Requester = requesterLookup[x.RequesterId], x.CreatedAt })
            .ToList();

        return Ok(new ApiResponse<object>(response));
    }

    [HttpPost("{userId:guid}/block")]
    public async Task<IActionResult> Block(Guid userId, CancellationToken cancellationToken)
    {
        var currentUserId = User.GetRequiredUserId();
        if (currentUserId == userId)
        {
            throw new ValidationException("You cannot block yourself", [("userId", "Target user must be different from the requester")]);
        }

        var targetExists = await dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == userId && x.IsActive, cancellationToken);
        if (!targetExists)
        {
            throw new NotFoundException("User not found");
        }

        var friendship = await dbContext.Friendships.FirstOrDefaultAsync(
            x => (x.RequesterId == currentUserId && x.AddresseeId == userId) || (x.RequesterId == userId && x.AddresseeId == currentUserId),
            cancellationToken);

        if (friendship is null)
        {
            friendship = new Friendship
            {
                Id = Guid.NewGuid(),
                RequesterId = currentUserId,
                AddresseeId = userId,
                Status = FriendshipStatuses.Blocked,
                CreatedAt = DateTimeOffset.UtcNow
            };
            dbContext.Friendships.Add(friendship);
        }
        else
        {
            friendship.Status = FriendshipStatuses.Blocked;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(new { friendship.Id, friendship.RequesterId, friendship.AddresseeId, friendship.Status, friendship.CreatedAt }));
    }
}

[ApiController]
[Authorize]
[Route("api/core/notifications")]
public sealed class NotificationsController(CoreDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = CoreLimits.DefaultNotificationPageSize, CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        var normalizedPage = page <= 0 ? 1 : page;
        var normalizedPageSize = pageSize <= 0 ? CoreLimits.DefaultNotificationPageSize : Math.Min(pageSize, CoreLimits.MaxNotificationPageSize);

        var query = dbContext.Notifications.AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .Select(x => new { x.Id, x.Type, x.Title, x.Body, x.ReferenceId, x.IsRead, x.CreatedAt })
            .ToListAsync(cancellationToken);

        return Ok(new ApiResponse<object>(items, new
        {
            page = normalizedPage,
            pageSize = normalizedPageSize,
            total,
            totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)normalizedPageSize)
        }));
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> Read(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
                           ?? throw new NotFoundException("Notification not found");

        notification.IsRead = true;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ApiResponse<object>(new { notification.Id, notification.IsRead }));
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var notifications = await dbContext.Notifications.Where(x => x.UserId == userId && !x.IsRead).ToListAsync(cancellationToken);
        foreach (var notification in notifications)
        {
            notification.IsRead = true;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(new { updated = notifications.Count }));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var notification = await dbContext.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId, cancellationToken)
                           ?? throw new NotFoundException("Notification not found");

        dbContext.Notifications.Remove(notification);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var unreadCount = await dbContext.Notifications.AsNoTracking().CountAsync(x => x.UserId == userId && !x.IsRead, cancellationToken);
        return Ok(new ApiResponse<object>(new { unreadCount }));
    }
}

[ApiController]
[Authorize]
[Route("api/core/live")]
public sealed class LiveSessionController(CoreDbContext dbContext, IKafkaProducerService kafkaProducerService) : ControllerBase
{
    [HttpPost("start/{tripId:guid}")]
    public async Task<IActionResult> Start(Guid tripId, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var existingSession = await dbContext.LiveSessions.FirstOrDefaultAsync(x => x.TripId == tripId && x.UserId == userId && x.IsActive, cancellationToken);
        if (existingSession is not null)
        {
            existingSession.LastPingAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new ApiResponse<object>(existingSession));
        }

        var session = new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = userId,
            Latitude = CoreDefaults.InitialLatitude,
            Longitude = CoreDefaults.InitialLongitude,
            IsActive = true,
            LastPingAt = DateTimeOffset.UtcNow
        };

        dbContext.LiveSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<object>(session));
    }

    [HttpPut("ping")]
    public async Task<IActionResult> Ping([FromBody] PingLocationRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var session = await dbContext.LiveSessions.FirstOrDefaultAsync(
                          x => x.TripId == request.TripId && x.UserId == userId && x.IsActive,
                          cancellationToken)
                      ?? throw new NotFoundException("Live session not found");

        session.Latitude = request.Latitude;
        session.Longitude = request.Longitude;
        session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync(KafkaTopics.LiveLocationUpdated, new { session.TripId, session.UserId, session.Latitude, session.Longitude, session.LastPingAt }, cancellationToken);

        return Ok(new ApiResponse<object>(session));
    }

    [HttpPost("stop")]
    public async Task<IActionResult> Stop([FromBody] StopLiveSessionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var activeSessions = await dbContext.LiveSessions
            .Where(x => x.TripId == request.TripId && x.UserId == userId && x.IsActive)
            .ToListAsync(cancellationToken);

        if (activeSessions.Count == 0)
        {
            throw new NotFoundException("Live session not found");
        }

        foreach (var session in activeSessions)
        {
            session.IsActive = false;
            session.LastPingAt = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [HttpGet("trip/{tripId:guid}")]
    public async Task<IActionResult> Trip(Guid tripId, CancellationToken cancellationToken)
    {
        var sessions = await dbContext.LiveSessions.AsNoTracking()
            .Where(x => x.TripId == tripId && x.IsActive)
            .OrderByDescending(x => x.LastPingAt)
            .ToListAsync(cancellationToken);

        return Ok(new ApiResponse<object>(sessions));
    }
}

[ApiController]
[Route("api/core/health")]
public sealed class HealthController(CoreDbContext dbContext, IKafkaHealthCheckService kafkaHealthCheckService) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        bool databaseHealthy;
        try
        {
            using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutSource.CancelAfter(CoreDefaults.HealthCheckTimeoutMilliseconds);
            databaseHealthy = await dbContext.Database.CanConnectAsync(timeoutSource.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            databaseHealthy = false;
        }
        catch
        {
            databaseHealthy = false;
        }

        var kafkaHealthy = await kafkaHealthCheckService.IsHealthyAsync(cancellationToken);
        var overallStatus = databaseHealthy && kafkaHealthy ? "healthy" : "degraded";

        return Ok(new { status = overallStatus, version = CoreDefaults.ServiceVersion, uptime = Environment.TickCount64 });
    }
}

internal static class ClaimsPrincipalExtensions
{
    public static Guid GetRequiredUserId(this ClaimsPrincipal principal)
    {
        var rawUserId = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue(CoreClaimTypes.Subject);
        if (!Guid.TryParse(rawUserId, out var userId))
        {
            throw new UnauthorizedException("Missing or invalid user identifier");
        }

        return userId;
    }
}
