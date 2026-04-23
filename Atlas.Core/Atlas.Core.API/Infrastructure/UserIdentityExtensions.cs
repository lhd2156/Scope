using System.Security.Claims;
using Atlas.Core.Domain.Exceptions;
using Microsoft.AspNetCore.SignalR;

namespace Atlas.Core.API.Infrastructure;

internal static class UserIdentityExtensions
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

    public static string? GetUserIdString(this HubCallerContext context)
        => context.UserIdentifier
            ?? context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User?.FindFirstValue("sub");

    public static Guid GetRequiredUserId(this HubCallerContext context)
    {
        var rawUserId = context.GetUserIdString();
        if (Guid.TryParse(rawUserId, out var userId))
        {
            return userId;
        }

        throw new UnauthorizedException("Missing user identity");
    }
}
