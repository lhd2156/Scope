using System.Text.RegularExpressions;
using Xunit;

namespace Atlas.Core.Tests.Services;

public sealed class SourceHygieneTests
{
    private static readonly string[] ProductionDirectories =
    [
        "Atlas.Core.API",
        "Atlas.Core.Domain",
        "Atlas.Core.Infrastructure"
    ];

    [Fact]
    public void ProductionSource_DoesNotContainTodoFixmeOrDebugWriteStatements()
    {
        var offenders = FindMatches(
            new Regex(@"\b(TODO|FIXME)\b|Debug\.Write|Trace\.Write|Console\.Write(Line)?", RegexOptions.Compiled));

        Assert.True(offenders.Count == 0, $"Found source hygiene violations:{Environment.NewLine}{string.Join(Environment.NewLine, offenders)}");
    }

    [Fact]
    public void ProductionSource_DoesNotContainPlaceholderSecretsOrLocalhostOrigins()
    {
        var offenders = FindMatches(
            new Regex(@"Atlas_Dev_2026|super-secret|change-me-in-prod|localhost:5173|kafka:9092|https?://localhost", RegexOptions.Compiled | RegexOptions.IgnoreCase));

        Assert.True(offenders.Count == 0, $"Found hardcoded placeholder values:{Environment.NewLine}{string.Join(Environment.NewLine, offenders)}");
    }

    private static List<string> FindMatches(Regex pattern)
    {
        var offenders = new List<string>();
        foreach (var filePath in EnumerateProductionFiles())
        {
            var lines = File.ReadAllLines(filePath);
            for (var index = 0; index < lines.Length; index++)
            {
                if (pattern.IsMatch(lines[index]))
                {
                    offenders.Add($"{Path.GetRelativePath(GetRepositoryRoot(), filePath)}:{index + 1}:{lines[index].Trim()}");
                }
            }
        }

        return offenders;
    }

    private static IEnumerable<string> EnumerateProductionFiles()
    {
        var root = GetRepositoryRoot();
        return ProductionDirectories
            .Select(directory => Path.Combine(root, directory))
            .Where(Directory.Exists)
            .SelectMany(directory => Directory.EnumerateFiles(directory, "*.*", SearchOption.AllDirectories))
            .Where(filePath => filePath.EndsWith(".cs", StringComparison.OrdinalIgnoreCase) || filePath.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            .Where(filePath => !filePath.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase))
            .Where(filePath => !filePath.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.OrdinalIgnoreCase));
    }

    private static string GetRepositoryRoot()
        => Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
}
