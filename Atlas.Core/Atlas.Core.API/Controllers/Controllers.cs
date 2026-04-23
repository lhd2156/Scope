using System.Security.Claims;
using Atlas.Core.API.Contracts.Requests;
using Atlas.Core.API.Middleware;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Exceptions;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Atlas.Core.API.Controllers;

internal static class ControllerUserContext
{
    public static Guid GetRequiredUserId(this ClaimsPrincipal user)
    {
        var rawUserId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        if (Guid.TryParse(rawUserId, out var userId))
        {
            return userId;
        }

        throw new UnauthorizedException("Missing user identity");
    }
}

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
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? request, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.RefreshAsync(request?.RefreshToken ?? string.Empty, cancellationToken)));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest? request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request?.RefreshToken))
        {
            await authService.LogoutAsync(request.RefreshToken, cancellationToken);
        }

        return Ok(new ApiResponse<object>(new { success = true }));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await authService.GetCurrentUserAsync(User.GetRequiredUserId(), cancellationToken)));
}

[ApiController]
[Authorize]
[Route("api/core/users")]
public sealed class UsersController(CoreDbContext dbContext, IKafkaProducerService kafkaProducerService) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await dbContext.Users.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new { x.Id, x.Username, x.Email, x.DisplayName, x.Bio, x.AvatarUrl, x.CreatedAt }).FirstAsync(cancellationToken)));

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await dbContext.Users.AsNoTracking().Where(x => x.IsActive && (x.Username.Contains(q) || x.DisplayName.Contains(q))).OrderBy(x => x.DisplayName).Take(20).Select(x => new { x.Id, x.Username, x.DisplayName, x.AvatarUrl }).ToListAsync(cancellationToken)));
}

[ApiController]
[Authorize]
[Route("api/core/friends")]
public sealed class FriendsController(CoreDbContext dbContext, IKafkaProducerService kafkaProducerService) : ControllerBase
{
    [HttpPost("request/{userId:guid}")]
    public async Task<IActionResult> Request(Guid userId, CancellationToken cancellationToken)
    {
        var requesterId = User.GetRequiredUserId();
        var friendship = new Friendship { Id = Guid.NewGuid(), RequesterId = requesterId, AddresseeId = userId, Status = "pending", CreatedAt = DateTimeOffset.UtcNow };
        dbContext.Friendships.Add(friendship);
        dbContext.Notifications.Add(new Notification { Id = Guid.NewGuid(), UserId = userId, Type = "friend.request", Title = "New friend request", ReferenceId = friendship.Id.ToString(), CreatedAt = DateTimeOffset.UtcNow });
        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(201, new ApiResponse<object>(friendship));
    }

    [HttpPut("{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id, CancellationToken cancellationToken)
    {
        var friendship = await dbContext.Friendships.FirstAsync(x => x.Id == id, cancellationToken);
        friendship.Status = "accepted";
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("friend.accepted", new { friendship.Id, friendship.RequesterId, friendship.AddresseeId }, cancellationToken);
        return Ok(new ApiResponse<object>(friendship));
    }
}

[ApiController]
[Authorize]
[Route("api/core/notifications")]
public sealed class NotificationsController(CoreDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var userId = User.GetRequiredUserId();
        var query = dbContext.Notifications.AsNoTracking().Where(x => x.UserId == userId).OrderByDescending(x => x.CreatedAt);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return Ok(new ApiResponse<object>(items, new { page, pageSize, total, totalPages = (int)Math.Ceiling(total / (double)pageSize) }));
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
        var session = new LiveSession { Id = Guid.NewGuid(), TripId = tripId, UserId = userId, Latitude = 0, Longitude = 0, IsActive = true, LastPingAt = DateTimeOffset.UtcNow };
        dbContext.LiveSessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);
        return StatusCode(201, new ApiResponse<object>(session));
    }

    [HttpPut("ping")]
    public async Task<IActionResult> Ping([FromBody] PingLocationRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetRequiredUserId();
        var session = await dbContext.LiveSessions.FirstAsync(x => x.TripId == request.TripId && x.UserId == userId && x.IsActive, cancellationToken);
        session.Latitude = request.Latitude; session.Longitude = request.Longitude; session.LastPingAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await kafkaProducerService.PublishAsync("live.location.updated", new { session.TripId, session.UserId, session.Latitude, session.Longitude }, cancellationToken);
        return Ok(new ApiResponse<object>(session));
    }

    [HttpGet("trip/{tripId:guid}")]
    public async Task<IActionResult> Trip(Guid tripId, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await dbContext.LiveSessions.AsNoTracking().Where(x => x.TripId == tripId && x.IsActive).ToListAsync(cancellationToken)));
}

[ApiController]
[Route("api/core/health")]
public sealed class HealthController(CoreDbContext dbContext, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
        var bootstrap = configuration["KAFKA_BOOTSTRAP_SERVERS"];
        AtlasObservability.SetServiceHealth("core", canConnect);
        return Ok(new { status = canConnect ? "healthy" : "degraded", version = "1.0.0", uptime = Environment.TickCount64, checks = new { database = canConnect, kafka = !string.IsNullOrWhiteSpace(bootstrap) } });
    }
}
