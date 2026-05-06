namespace Scope.Core.API.Middleware;

public sealed class RateLimitOptions
{
    public const string SectionName = "RateLimit";

    public int GlobalLimit { get; set; } = 100;
    public int AuthLimit { get; set; } = 10;
    public int WindowSeconds { get; set; } = 60;
    public string RetryAfterSeconds { get; set; } = "60";
}
