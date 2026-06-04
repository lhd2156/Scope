namespace Scope.Core.API.Infrastructure;

internal static class BearerTokens
{
    public static string FromAuthorizationHeader(string? authorizationHeader)
    {
        if (!string.IsNullOrWhiteSpace(authorizationHeader) &&
            authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return authorizationHeader["Bearer ".Length..].Trim();
        }

        return string.Empty;
    }
}
