using System.Reflection;
using Scope.Core.API.Controllers;
using Xunit;

namespace Scope.Core.Tests.Infrastructure;

public sealed class PaginationTests
{
    [Fact]
    public void Normalize_ClampsUnsafePageAndPageSizeInputs()
    {
        var normalize = PaginationNormalizeMethod();

        var clamped = normalize.Invoke(null, [0, 500, 25, 50])
            ?? throw new InvalidOperationException("Normalize returned null.");
        Assert.Equal(1, GetInt(clamped, "Page"));
        Assert.Equal(50, GetInt(clamped, "PageSize"));
        Assert.Equal(0, GetInt(clamped, "Offset"));

        var defaulted = normalize.Invoke(null, [3, 0, 25, 50])
            ?? throw new InvalidOperationException("Normalize returned null.");
        Assert.Equal(3, GetInt(defaulted, "Page"));
        Assert.Equal(25, GetInt(defaulted, "PageSize"));
        Assert.Equal(50, GetInt(defaulted, "Offset"));

        var metadata = defaulted.GetType().GetMethod("ToMetadata")?.Invoke(defaulted, [51])
            ?? throw new InvalidOperationException("ToMetadata returned null.");
        Assert.Equal(3, GetInt(metadata, "page"));
        Assert.Equal(25, GetInt(metadata, "pageSize"));
        Assert.Equal(51, GetInt(metadata, "total"));
        Assert.Equal(3, GetInt(metadata, "totalPages"));
    }

    private static MethodInfo PaginationNormalizeMethod()
    {
        var type = typeof(HealthController).Assembly.GetType("Scope.Core.API.Infrastructure.Pagination")
            ?? throw new InvalidOperationException("Pagination type was not found.");
        return type.GetMethod("Normalize", BindingFlags.Public | BindingFlags.Static)
            ?? throw new MissingMethodException("Pagination", "Normalize");
    }

    private static int GetInt(object value, string propertyName)
        => (int)(value.GetType().GetProperty(propertyName)?.GetValue(value)
            ?? throw new InvalidOperationException($"Missing {propertyName} property."));
}
