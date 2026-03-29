using System.Text.RegularExpressions;
using Atlas.Core.API.Controllers;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Domain.Interfaces;
using Atlas.Core.Infrastructure.Services;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace Atlas.Core.Tests.Performance;

public sealed class ReadOnlyQueryAsNoTrackingTests
{
    [Fact]
    public async Task ReadOnlyControllerActions_DoNotLeaveTrackedEntitiesInFreshContexts()
    {
        var databaseName = Guid.NewGuid().ToString("N");

        await using (var seedContext = TestSupport.CreateDbContext(databaseName))
        {
            var user = TestSupport.CreateUser();
            var friend = TestSupport.CreateUser(username: "friend", email: "friend@example.com", displayName: "Friend User");
            seedContext.Users.AddRange(user, friend);
            seedContext.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Type = NotificationTypes.FriendRequest,
                Title = "Friend request",
                CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
            });
            seedContext.Friendships.Add(new Friendship
            {
                Id = Guid.NewGuid(),
                RequesterId = user.Id,
                AddresseeId = friend.Id,
                Status = FriendshipStatuses.Accepted,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
            });
            seedContext.LiveSessions.Add(new LiveSession
            {
                Id = Guid.NewGuid(),
                TripId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                UserId = user.Id,
                IsActive = true,
                Latitude = 32.7555,
                Longitude = -97.3308,
                LastPingAt = DateTimeOffset.UtcNow.AddMinutes(-1)
            });
            await seedContext.SaveChangesAsync();
        }

        var userId = await GetFirstUserIdAsync(databaseName);

        await using (var getContext = TestSupport.CreateDbContext(databaseName))
        {
            var controller = new UsersController(getContext, Mock.Of<IKafkaProducerService>(), Mock.Of<IAvatarStorageService>());
            await controller.Get(userId, CancellationToken.None);
            Assert.Empty(getContext.ChangeTracker.Entries());
        }

        await using (var searchContext = TestSupport.CreateDbContext(databaseName))
        {
            var controller = new UsersController(searchContext, Mock.Of<IKafkaProducerService>(), Mock.Of<IAvatarStorageService>());
            await controller.Search("Friend", CancellationToken.None);
            Assert.Empty(searchContext.ChangeTracker.Entries());
        }

        await using (var listContext = TestSupport.CreateDbContext(databaseName))
        {
            var controller = new FriendsController(listContext, Mock.Of<IKafkaProducerService>());
            TestSupport.AttachUser(controller, userId);
            await controller.List(CancellationToken.None);
            Assert.Empty(listContext.ChangeTracker.Entries());
        }

        await using (var notificationsContext = TestSupport.CreateDbContext(databaseName))
        {
            var controller = new NotificationsController(notificationsContext);
            TestSupport.AttachUser(controller, userId);
            await controller.List(1, 20, CancellationToken.None);
            await controller.UnreadCount(CancellationToken.None);
            Assert.Empty(notificationsContext.ChangeTracker.Entries());
        }

        await using (var tripContext = TestSupport.CreateDbContext(databaseName))
        {
            var controller = new LiveSessionController(tripContext, Mock.Of<IKafkaProducerService>());
            TestSupport.AttachUser(controller, userId);
            await controller.Trip(Guid.Parse("11111111-1111-1111-1111-111111111111"), CancellationToken.None);
            Assert.Empty(tripContext.ChangeTracker.Entries());
        }
    }

    [Fact]
    public async Task ReadOnlyAuthServiceQueries_DoNotLeaveTrackedEntitiesInFreshContext()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        var user = TestSupport.CreateUser();

        await using (var seedContext = TestSupport.CreateDbContext(databaseName))
        {
            seedContext.Users.Add(user);
            await seedContext.SaveChangesAsync();
        }

        await using var serviceContext = TestSupport.CreateDbContext(databaseName);
        var service = new AuthService(
            serviceContext,
            new PasswordHasherService(),
            Mock.Of<IJwtTokenService>(),
            Mock.Of<IKafkaProducerService>(),
            new Microsoft.Extensions.Configuration.ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>()).Build());

        await service.ForgotPasswordAsync(user.Email, CancellationToken.None);
        await service.GetCurrentUserAsync(user.Id, CancellationToken.None);

        Assert.Empty(serviceContext.ChangeTracker.Entries());
    }

    [Fact]
    public void AuditedReadOnlyQuerySites_ContainAsNoTrackingInProductionSource()
    {
        var controllersSource = Normalize(File.ReadAllText(Path.Combine(GetRepositoryRoot(), "Atlas.Core", "Atlas.Core.API", "Controllers", "Controllers.cs")));
        var servicesSource = Normalize(File.ReadAllText(Path.Combine(GetRepositoryRoot(), "Atlas.Core", "Atlas.Core.Infrastructure", "Services", "Services.cs")));

        string[] controllerExpectations =
        [
            "dbContext.Users.AsNoTracking() .Where(x => x.Id == id && x.IsActive)",
            "dbContext.Users.AsNoTracking() .Where(x => x.IsActive && (x.Username.Contains(query) || x.DisplayName.Contains(query) || x.Email.Contains(query)))",
            "dbContext.Users.AsNoTracking().AnyAsync(x => x.Id == id && x.IsActive, cancellationToken)",
            "dbContext.Friendships.AsNoTracking() .Where(x => x.Status == FriendshipStatuses.Accepted",
            "dbContext.Users.AsNoTracking() .Where(x => friendIds.Contains(x.Id) && x.IsActive)",
            "dbContext.Friendships.AsNoTracking() .Where(x => x.Status == FriendshipStatuses.Pending && x.AddresseeId == currentUserId)",
            "dbContext.Users.AsNoTracking() .Where(x => requesterIds.Contains(x.Id) && x.IsActive)",
            "dbContext.Notifications.AsNoTracking() .Where(x => x.UserId == userId)",
            "dbContext.Notifications.AsNoTracking().CountAsync(x => x.UserId == userId && !x.IsRead, cancellationToken)",
            "dbContext.LiveSessions.AsNoTracking() .Where(x => x.TripId == tripId && x.IsActive)"
        ];

        string[] serviceExpectations =
        [
            "dbContext.Users.AsNoTracking() .AnyAsync(x => x.Email == normalizedEmail || x.Username == normalizedUsername, cancellationToken)",
            "dbContext.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Email == normalizedEmail && x.IsActive, cancellationToken)",
            "dbContext.Users.AsNoTracking() .Where(x => x.Id == userId && x.IsActive)",
            "dbContext.Users.AsNoTracking().AnyAsync(x => x.Username == uniqueCandidate, cancellationToken)"
        ];

        Assert.All(controllerExpectations, expectation => Assert.Contains(Normalize(expectation), controllersSource, StringComparison.Ordinal));
        Assert.All(serviceExpectations, expectation => Assert.Contains(Normalize(expectation), servicesSource, StringComparison.Ordinal));
    }

    private static async Task<Guid> GetFirstUserIdAsync(string databaseName)
    {
        await using var context = TestSupport.CreateDbContext(databaseName);
        return (await context.Users.OrderBy(x => x.CreatedAt).Select(x => x.Id).FirstAsync())!;
    }

    private static string GetRepositoryRoot()
        => Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));

    private static string Normalize(string text)
        => Regex.Replace(text, "\\s+", " ").Trim();
}
