using Microsoft.Extensions.Logging;

namespace Scope.Core.API.Middleware;

// Correlation / request IDs stitch logs, traces, and upstream calls together.
// We accept ``X-Correlation-Id`` from the edge if it's present and looks sane
// (letters, digits, hyphens, <= 128 chars), otherwise we mint a fresh id.
// The id is:
//   * put on HttpContext.TraceIdentifier so it flows into every log line
//   * exposed to logs via a logging scope
//   * echoed back to clients via the ``X-Correlation-Id`` response header
//   * readable by downstream handlers for outbound HTTP propagation
public sealed class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public const string HeaderName = "X-Correlation-Id";
    private const int MaxLength = 128;

    public Task InvokeAsync(HttpContext context)
    {
        var correlationId = SanitizeOrNew(context.Request.Headers[HeaderName].ToString());
        context.TraceIdentifier = correlationId;
        context.Items[HeaderName] = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        using var scope = logger.BeginScope(new Dictionary<string, object>
        {
            ["scope.correlation_id"] = correlationId,
        });
        return next(context);
    }

    private static string SanitizeOrNew(string? candidate)
    {
        if (!string.IsNullOrWhiteSpace(candidate) && candidate.Length <= MaxLength && IsSafe(candidate))
        {
            return candidate;
        }
        return Guid.NewGuid().ToString("n");
    }

    private static bool IsSafe(string value)
    {
        foreach (var ch in value)
        {
            var ok = ch is (>= 'a' and <= 'z') or (>= 'A' and <= 'Z') or (>= '0' and <= '9') or '-' or '_';
            if (!ok) return false;
        }
        return true;
    }
}
