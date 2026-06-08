namespace Scope.Core.API.Infrastructure;

public static class ProfileVisibilityPolicy
{
    public const string Public = "public";
    public const string Friends = "friends";
    public const string Private = "private";

    public static bool IsValid(string? value)
        => value is Public or Friends or Private;

    public static string Normalize(string? value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        return IsValid(normalized) ? normalized! : Friends;
    }

    public static bool CanSeePlanningContext(
        string? visibility,
        bool isOwnerOrAdmin,
        bool isAcceptedFriend,
        bool isShowcase = false)
    {
        if (isOwnerOrAdmin || isShowcase)
        {
            return true;
        }

        return Normalize(visibility) switch
        {
            Public => true,
            Friends => isAcceptedFriend,
            _ => false,
        };
    }

    public static string? ToPublicHomeBase(string? homeBase)
    {
        if (string.IsNullOrWhiteSpace(homeBase))
        {
            return null;
        }

        var parts = homeBase
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return parts.Length switch
        {
            >= 2 => string.Join(", ", parts[^2], parts[^1]),
            _ => null,
        };
    }
}
