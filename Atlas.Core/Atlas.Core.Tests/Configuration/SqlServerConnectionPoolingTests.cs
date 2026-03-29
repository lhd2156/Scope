using System.Data.Common;
using Atlas.Core.API.Configuration;
using Atlas.Core.Domain.Constants;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Atlas.Core.Tests.Configuration;

public sealed class SqlServerConnectionPoolingTests
{
    [Fact]
    public void FromConfiguration_ReturnsDefaultsWhenOverridesAreMissing()
    {
        var configuration = new ConfigurationBuilder().Build();

        var options = SqlServerConnectionPoolingOptions.FromConfiguration(configuration);

        Assert.Equal(CoreDefaults.DbContextPoolSize, options.DbContextPoolSize);
        Assert.Equal(CoreDefaults.DatabaseMinPoolSize, options.MinPoolSize);
        Assert.Equal(CoreDefaults.DatabaseMaxPoolSize, options.MaxPoolSize);
        Assert.Equal(CoreDefaults.DatabaseConnectTimeoutSeconds, options.ConnectTimeoutSeconds);
    }

    [Fact]
    public void FromConfiguration_RejectsInvalidPoolRanges()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [CoreConfigurationKeys.DatabaseMinPoolSize] = "10",
                [CoreConfigurationKeys.DatabaseMaxPoolSize] = "5"
            })
            .Build();

        Assert.Throws<InvalidOperationException>(() => SqlServerConnectionPoolingOptions.FromConfiguration(configuration));
    }

    [Fact]
    public void ApplyPooling_AddsExplicitPoolingDefaultsWhenConnectionStringOmitsThem()
    {
        var connectionString = "Server=(localdb)\\mssqllocaldb;Database=atlas_core;Trusted_Connection=True;TrustServerCertificate=True";
        var options = new SqlServerConnectionPoolingOptions
        {
            DbContextPoolSize = 64,
            MinPoolSize = 5,
            MaxPoolSize = 120,
            ConnectTimeoutSeconds = 30
        };

        var pooledConnectionString = SqlServerConnectionStringFactory.ApplyPooling(connectionString, options);
        var builder = new DbConnectionStringBuilder
        {
            ConnectionString = pooledConnectionString
        };

        Assert.True(Convert.ToBoolean(builder["Pooling"]));
        Assert.Equal(5, Convert.ToInt32(builder["Min Pool Size"]));
        Assert.Equal(120, Convert.ToInt32(builder["Max Pool Size"]));
        Assert.Equal(30, Convert.ToInt32(builder["Connect Timeout"]));
    }

    [Fact]
    public void ApplyPooling_PreservesExplicitConnectionStringValuesWhileForcingPoolingOn()
    {
        var connectionString = "Server=(localdb)\\mssqllocaldb;Database=atlas_core;Trusted_Connection=True;TrustServerCertificate=True;Pooling=False;Min Pool Size=7;Max Pool Size=200;Connect Timeout=45";
        var options = new SqlServerConnectionPoolingOptions
        {
            DbContextPoolSize = 64,
            MinPoolSize = 5,
            MaxPoolSize = 120,
            ConnectTimeoutSeconds = 30
        };

        var pooledConnectionString = SqlServerConnectionStringFactory.ApplyPooling(connectionString, options);
        var builder = new DbConnectionStringBuilder
        {
            ConnectionString = pooledConnectionString
        };

        Assert.True(Convert.ToBoolean(builder["Pooling"]));
        Assert.Equal(7, Convert.ToInt32(builder["Min Pool Size"]));
        Assert.Equal(200, Convert.ToInt32(builder["Max Pool Size"]));
        Assert.Equal(45, Convert.ToInt32(builder["Connect Timeout"]));
    }
}
