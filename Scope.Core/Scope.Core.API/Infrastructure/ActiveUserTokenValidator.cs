using System.Security.Claims;
using Scope.Core.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Infrastructure;

public static class ActiveUserTokenValidator
{
    public static async Task<bool> IsActiveUserAsync(
        ClaimsPrincipal? principal,
        CoreDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var rawUserId = principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal?.FindFirstValue("sub");
        if (!Guid.TryParse(rawUserId, out var userId))
        {
            return false;
        }

        return await dbContext.Users
            .AsNoTracking()
            .AnyAsync(x => x.Id == userId && x.IsActive, cancellationToken);
    }
}
