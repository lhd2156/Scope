using System.Data.Common;
using System.Reflection;
using System.Security.Claims;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class PresenceControllerTests
{
    [Fact]
    public async Task Heartbeat_StoresPlanningActivity()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(CreateUser(userId, "planner"));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);

        var result = await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "online", RouteContext: "/trips/new#ai", IsPlanning: true),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        Assert.NotNull(response.Data);

        var presence = await dbContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.Equal("planning", presence.Status);
        Assert.Equal("/trips/new#ai", presence.RouteContext);
        Assert.False(presence.IsIdle);
        Assert.NotNull(presence.LastPlanningAt);
    }

    [Fact]
    public async Task Heartbeat_IdleOverridesRequestedStatus()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(CreateUser(userId, "idle"));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);

        await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "planning", RouteContext: "/trips/new", IsIdle: true, IsPlanning: true),
            CancellationToken.None);

        var presence = await dbContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.Equal("idle", presence.Status);
        Assert.True(presence.IsIdle);
        Assert.NotNull(presence.LastPlanningAt);
    }

    [Fact]
    public async Task Heartbeat_AllowsConcurrentFirstHeartbeats()
    {
        var userId = Guid.NewGuid();
        var connectionString = $"Data Source=file:presence-{Guid.NewGuid():N};Mode=Memory;Cache=Shared;Default Timeout=30";
        await using var keepAliveConnection = new SqliteConnection(connectionString);
        await keepAliveConnection.OpenAsync();
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseSqlite(connectionString)
            .Options;

        await using (var setupContext = new CoreDbContext(options))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.Users.Add(CreateUser(userId, "race"));
            await setupContext.SaveChangesAsync();
        }

        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = Enumerable.Range(0, 6)
            .Select(async index =>
            {
                await using var requestContext = new CoreDbContext(options);
                var controller = CreateController(requestContext, userId);

                await start.Task;
                return await controller.Heartbeat(
                    new PresenceHeartbeatRequest(Status: index % 2 == 0 ? "online" : "planning", RouteContext: "/map", IsIdle: false, IsPlanning: index % 2 == 1),
                    CancellationToken.None);
            })
            .ToArray();

        start.SetResult();
        var results = await Task.WhenAll(tasks);

        Assert.All(results, result => Assert.IsType<OkObjectResult>(result));
        await using var verifyContext = new CoreDbContext(options);
        var presence = await verifyContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.True(presence.Status is "online" or "planning", $"Unexpected status: {presence.Status}");
        Assert.Equal("/map", presence.RouteContext);
    }

    [Fact]
    public async Task Heartbeat_CapsRouteContextToStoredLength()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(CreateUser(userId, "route"));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);
        var longRoute = "/" + new string('x', 220);

        await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "online", RouteContext: longRoute, IsIdle: false, IsPlanning: false),
            CancellationToken.None);

        var presence = await dbContext.UserPresences.SingleAsync(x => x.UserId == userId);
        Assert.NotNull(presence.RouteContext);
        Assert.Equal(160, presence.RouteContext.Length);
        Assert.Equal(longRoute[..160], presence.RouteContext);
    }

    [Fact]
    public async Task Heartbeat_ReturnsAcceptedWhenPersistenceTimesOut()
    {
        var userId = Guid.NewGuid();
        var databaseName = Guid.NewGuid().ToString();

        await using (var setupContext = CreateDbContext(databaseName))
        {
            setupContext.Users.Add(CreateUser(userId, "transient"));
            setupContext.UserPresences.Add(new UserPresence
            {
                UserId = userId,
                Status = "offline",
                LastActiveAt = DateTimeOffset.UtcNow.AddMinutes(-5),
                UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-5),
            });
            await setupContext.SaveChangesAsync();
        }

        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(databaseName)
            .AddInterceptors(new TimeoutOnSaveInterceptor())
            .Options;
        await using var dbContext = new CoreDbContext(options);
        var controller = CreateController(dbContext, userId);

        var result = await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "planning", RouteContext: "/trips/new", IsPlanning: true),
            CancellationToken.None);

        var accepted = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status202Accepted, accepted.StatusCode);
        var response = Assert.IsType<ApiResponse<object>>(accepted.Value);
        Assert.False(GetBooleanProperty(response.Data, "Persisted"));
    }

    [Fact]
    public async Task Heartbeat_ReturnsAcceptedWithTransientPresenceWhenInitialReadTimesOut()
    {
        var userId = Guid.NewGuid();
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var setupOptions = new DbContextOptionsBuilder<CoreDbContext>()
            .UseSqlite(connection)
            .Options;

        await using (var setupContext = new CoreDbContext(setupOptions))
        {
            await setupContext.Database.EnsureCreatedAsync();
            setupContext.Users.Add(CreateUser(userId, "read-timeout"));
            await setupContext.SaveChangesAsync();
        }

        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseSqlite(connection)
            .AddInterceptors(new TimeoutOnQueryInterceptor())
            .Options;
        await using var dbContext = new CoreDbContext(options);
        var controller = CreateController(dbContext, userId);

        var result = await controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "OFFLINE", RouteContext: null, IsIdle: false, IsPlanning: false),
            CancellationToken.None);

        var accepted = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status202Accepted, accepted.StatusCode);
        var response = Assert.IsType<ApiResponse<object>>(accepted.Value);
        Assert.False(GetBooleanProperty(response.Data, "Persisted"));
        Assert.Equal("offline", GetStringProperty(response.Data, "Status"));
        Assert.Null(GetNullableStringProperty(response.Data, "RouteContext"));
    }

    [Fact]
    public async Task Heartbeat_PropagatesNonTransientPersistenceFailures()
    {
        var userId = Guid.NewGuid();
        var databaseName = Guid.NewGuid().ToString();

        await using (var setupContext = CreateDbContext(databaseName))
        {
            setupContext.Users.Add(CreateUser(userId, "non-transient"));
            await setupContext.SaveChangesAsync();
        }

        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(databaseName)
            .AddInterceptors(new InvalidOperationOnSaveInterceptor())
            .Options;
        await using var dbContext = new CoreDbContext(options);
        var controller = CreateController(dbContext, userId);

        await Assert.ThrowsAsync<InvalidOperationException>(() => controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: null, RouteContext: null, IsIdle: false, IsPlanning: false),
            CancellationToken.None));
    }

    [Fact]
    public async Task Heartbeat_RethrowsFirstInsertConflictWhenNoPersistedPresenceCanBeLoaded()
    {
        var userId = Guid.NewGuid();
        var databaseName = Guid.NewGuid().ToString();

        await using (var setupContext = CreateDbContext(databaseName))
        {
            setupContext.Users.Add(CreateUser(userId, "missing-race"));
            await setupContext.SaveChangesAsync();
        }

        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(databaseName)
            .AddInterceptors(new ConflictOnSaveInterceptor())
            .Options;
        await using var dbContext = new CoreDbContext(options);
        var controller = CreateController(dbContext, userId);

        await Assert.ThrowsAsync<DbUpdateException>(() => controller.Heartbeat(
            new PresenceHeartbeatRequest(Status: "online", RouteContext: "/map", IsIdle: false, IsPlanning: false),
            CancellationToken.None));
    }

    [Theory]
    [InlineData(-2, true)]
    [InlineData(1205, true)]
    [InlineData(2601, false)]
    public void IsTransientSqlErrorNumber_AllowsOnlyTimeoutAndDeadlockNumbers(int number, bool expected)
    {
        Assert.Equal(expected, IsTransientSqlErrorNumber(number));
    }

    private static CoreDbContext CreateDbContext()
        => CreateDbContext(Guid.NewGuid().ToString());

    private static CoreDbContext CreateDbContext(string databaseName)
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;
        return new CoreDbContext(options);
    }

    private static User CreateUser(Guid userId, string username) => new()
    {
        Id = userId,
        Username = username,
        Email = $"{username}@example.com",
        DisplayName = username,
        PasswordHash = "hash",
        IsActive = true,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static PresenceController CreateController(CoreDbContext dbContext, Guid userId)
        => new(dbContext, NullLogger<PresenceController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                    ], "test"))
                }
            }
        };

    private static bool GetBooleanProperty(object? value, string propertyName)
        => (bool)(value?.GetType().GetProperty(propertyName)?.GetValue(value)
            ?? throw new InvalidOperationException($"Missing {propertyName} property."));

    private static string GetStringProperty(object? value, string propertyName)
        => (string)(value?.GetType().GetProperty(propertyName)?.GetValue(value)
            ?? throw new InvalidOperationException($"Missing {propertyName} property."));

    private static string? GetNullableStringProperty(object? value, string propertyName)
        => (string?)value?.GetType().GetProperty(propertyName)?.GetValue(value);

    private static bool IsTransientSqlErrorNumber(int number)
    {
        var method = typeof(PresenceController).GetMethod("IsTransientSqlErrorNumber", BindingFlags.Static | BindingFlags.NonPublic)
            ?? throw new MissingMethodException(nameof(PresenceController), "IsTransientSqlErrorNumber");
        return (bool)method.Invoke(null, [number])!;
    }

    private sealed class TimeoutOnSaveInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
            => ValueTask.FromException<InterceptionResult<int>>(new TimeoutException("Simulated transient timeout."));
    }

    private sealed class TimeoutOnQueryInterceptor : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
            => ValueTask.FromException<InterceptionResult<DbDataReader>>(new TimeoutException("Simulated transient read timeout."));
    }

    private sealed class InvalidOperationOnSaveInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
            => ValueTask.FromException<InterceptionResult<int>>(new InvalidOperationException("Permanent failure."));
    }

    private sealed class ConflictOnSaveInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
            => ValueTask.FromException<InterceptionResult<int>>(new DbUpdateException("Simulated first insert conflict."));
    }
}
