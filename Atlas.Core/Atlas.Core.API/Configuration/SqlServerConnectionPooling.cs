using System.Data.Common;
using Atlas.Core.Domain.Constants;
using Microsoft.Extensions.Configuration;

namespace Atlas.Core.API.Configuration;

public sealed class SqlServerConnectionPoolingOptions
{
    public int DbContextPoolSize { get; init; } = CoreDefaults.DbContextPoolSize;
    public int MinPoolSize { get; init; } = CoreDefaults.DatabaseMinPoolSize;
    public int MaxPoolSize { get; init; } = CoreDefaults.DatabaseMaxPoolSize;
    public int ConnectTimeoutSeconds { get; init; } = CoreDefaults.DatabaseConnectTimeoutSeconds;

    public static SqlServerConnectionPoolingOptions FromConfiguration(IConfiguration configuration)
    {
        var options = new SqlServerConnectionPoolingOptions
        {
            DbContextPoolSize = GetPositiveInt(configuration, CoreConfigurationKeys.DbContextPoolSize, CoreDefaults.DbContextPoolSize),
            MinPoolSize = GetNonNegativeInt(configuration, CoreConfigurationKeys.DatabaseMinPoolSize, CoreDefaults.DatabaseMinPoolSize),
            MaxPoolSize = GetPositiveInt(configuration, CoreConfigurationKeys.DatabaseMaxPoolSize, CoreDefaults.DatabaseMaxPoolSize),
            ConnectTimeoutSeconds = GetPositiveInt(configuration, CoreConfigurationKeys.DatabaseConnectTimeoutSeconds, CoreDefaults.DatabaseConnectTimeoutSeconds)
        };

        if (options.MinPoolSize > options.MaxPoolSize)
        {
            throw new InvalidOperationException($"{CoreConfigurationKeys.DatabaseMinPoolSize} cannot be greater than {CoreConfigurationKeys.DatabaseMaxPoolSize}.");
        }

        return options;
    }

    private static int GetPositiveInt(IConfiguration configuration, string key, int defaultValue)
    {
        var rawValue = configuration[key];
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return defaultValue;
        }

        if (!int.TryParse(rawValue, out var parsedValue) || parsedValue <= 0)
        {
            throw new InvalidOperationException($"{key} must be a positive integer.");
        }

        return parsedValue;
    }

    private static int GetNonNegativeInt(IConfiguration configuration, string key, int defaultValue)
    {
        var rawValue = configuration[key];
        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return defaultValue;
        }

        if (!int.TryParse(rawValue, out var parsedValue) || parsedValue < 0)
        {
            throw new InvalidOperationException($"{key} must be a non-negative integer.");
        }

        return parsedValue;
    }
}

public static class SqlServerConnectionStringFactory
{
    public static string ApplyPooling(string connectionString, SqlServerConnectionPoolingOptions options)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        ArgumentNullException.ThrowIfNull(options);

        var builder = new DbConnectionStringBuilder
        {
            ConnectionString = connectionString
        };

        builder["Pooling"] = true;

        if (!ContainsAnyKey(connectionString, "Min Pool Size"))
        {
            builder["Min Pool Size"] = options.MinPoolSize;
        }

        if (!ContainsAnyKey(connectionString, "Max Pool Size"))
        {
            builder["Max Pool Size"] = options.MaxPoolSize;
        }

        if (!ContainsAnyKey(connectionString, "Connect Timeout", "Connection Timeout"))
        {
            builder["Connect Timeout"] = options.ConnectTimeoutSeconds;
        }

        return builder.ConnectionString;
    }

    private static bool ContainsAnyKey(string connectionString, params string[] keys)
    {
        var configuredKeys = connectionString
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(segment => segment.Split('=', 2)[0].Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return keys.Any(configuredKeys.Contains);
    }
}
