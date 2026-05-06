using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting("global")]
[Route("api/core/users")]
public sealed class UsersController(CoreDbContext dbContext) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await dbContext.Users.AsNoTracking().Where(x => x.Id == id && x.IsActive).Select(x => new { x.Id, x.Username, x.Email, x.DisplayName, x.Bio, x.AvatarUrl, x.CreatedAt }).FirstAsync(cancellationToken)));

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken cancellationToken)
        => Ok(new ApiResponse<object>(await dbContext.Users.AsNoTracking().Where(x => x.IsActive && (x.Username.Contains(q) || x.DisplayName.Contains(q))).OrderBy(x => x.DisplayName).Take(20).Select(x => new { x.Id, x.Username, x.DisplayName, x.AvatarUrl }).ToListAsync(cancellationToken)));
}
