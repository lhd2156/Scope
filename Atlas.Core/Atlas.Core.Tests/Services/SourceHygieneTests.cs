using System.Text.RegularExpressions;
using Xunit;

namespace Atlas.Core.Tests.Services;

public sealed class SourceHygieneTests
{
    private static readonly string[] ProductionDirectories =
    [
        Path.Combine("Atlas.Core", "Atlas.Core.API"),
        Path.Combine("Atlas.Core", "Atlas.Core.Domain"),
        Path.Combine("Atlas.Core", "Atlas.Core.Infrastructure")
    ];

    [Fact]
    public void ProductionSource_DoesNotContainTodoFixmeDebugWriteOrDisabledCodeMarkers()
    {
        var offenders = FindMatches(
            new Regex(@"\b(TODO|FIXME)\b|Debug\.Write|Trace\.Write|Console\.Write(Line)?|NotImplementedException|#if\s+false", RegexOptions.Compiled | RegexOptions.IgnoreCase));

        AssertNoOffenders("Found source hygiene violations", offenders);
    }

    [Fact]
    public void ProductionSource_DoesNotContainCommentedOutCode()
    {
        var offenders = FindMatches(
            new Regex(@"^\s*//\s*(using\s+|return\s+|await\s+|var\s+|if\s*\(|foreach\s*\(|for\s*\(|while\s*\(|public\s+|private\s+|protected\s+|internal\s+|class\s+|record\s+|interface\s+|new\s+|throw\s+|[A-Za-z_][A-Za-z0-9_<>,\[\]\?]*\s+[A-Za-z_][A-Za-z0-9_]*\s*[=;(])", RegexOptions.Compiled));

        AssertNoOffenders("Found commented-out code in production source", offenders);
    }

    [Fact]
    public void ProductionSource_DoesNotContainPlaceholderSecretsOrUnsanctionedLocalUrls()
    {
        var offenders = FindMatches(
            new Regex(@"Atlas_Dev_2026|super-secret|change-me-in-prod|kafka:9092|https?://localhost(?!:5173\b)", RegexOptions.Compiled | RegexOptions.IgnoreCase));

        AssertNoOffenders("Found hardcoded placeholder values", offenders);
    }

    [Fact]
    public void ProductionSource_UsesDevelopmentFrontendOriginOnlyInSharedConstant()
    {
        var matches = FindMatches(new Regex(@"http://localhost:5173", RegexOptions.Compiled | RegexOptions.IgnoreCase));
        var expectedRelativePath = NormalizeRelativePath(Path.Combine("Atlas.Core", "Atlas.Core.Domain", "Constants", "CorePlatformConstants.cs"));

        Assert.Single(matches);
        Assert.All(matches, match => Assert.Equal(expectedRelativePath, NormalizeRelativePath(match.RelativePath)));
    }

    private static List<SourceMatch> FindMatches(Regex pattern)
    {
        var offenders = new List<SourceMatch>();
        foreach (var filePath in EnumerateProductionFiles())
        {
            var lines = File.ReadAllLines(filePath);
            for (var index = 0; index < lines.Length; index++)
            {
                if (pattern.IsMatch(lines[index]))
                {
                    offenders.Add(new SourceMatch(
                        Path.GetRelativePath(GetRepositoryRoot(), filePath),
                        index + 1,
                        lines[index].Trim()));
                }
            }
        }

        return offenders;
    }

    private static void AssertNoOffenders(string message, IReadOnlyList<SourceMatch> offenders)
    {
        Assert.True(
            offenders.Count == 0,
            $"{message}:{Environment.NewLine}{string.Join(Environment.NewLine, offenders.Select(FormatMatch))}");
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

    private static string NormalizeRelativePath(string relativePath)
        => relativePath.Replace('\\', '/');

    private static string FormatMatch(SourceMatch match)
        => $"{NormalizeRelativePath(match.RelativePath)}:{match.LineNumber}:{match.Line}";

    private sealed record SourceMatch(string RelativePath, int LineNumber, string Line);
}
