namespace Scope.Core.API.Middleware;

public sealed class RateLimitOptions
{
    public const string SectionName = "RateLimit";

    public int GlobalLimit { get; set; } = 600;
    public int AuthLimit { get; set; } = 10;
    public int RefreshLimit { get; set; } = 120;
    public int WindowSeconds { get; set; } = 60;
    public string RetryAfterSeconds { get; set; } = "60";
}
