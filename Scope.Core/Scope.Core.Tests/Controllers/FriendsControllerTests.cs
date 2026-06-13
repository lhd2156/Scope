using System.Security.Claims;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Interfaces;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class FriendsControllerTests
{
    [Fact]
    public async Task List_HidesPresence_WhenFriendDisabledActivityStatus()
    {
        var callerId = Guid.NewGuid();
        var friendId = Guid.NewGuid();
        var friendshipId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            CreateUser(callerId, "caller"),
            CreateUser(friendId, "friend", showActivityStatus: false));
        dbContext.Friendships.Add(new Friendship
        {
            Id = friendshipId,
            RequesterId = callerId,
            AddresseeId = friendId,
            Status = "accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.UserPresences.Add(new UserPresence
        {
            UserId = friendId,
            Status = "planning",
            RouteContext = "/trips/new",
            LastActiveAt = DateTimeOffset.UtcNow,
            LastPlanningAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.List(cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        var item = Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(response.Data));
        Assert.Equal("hidden", GetString(item, "presence"));
    }

    [Fact]
    public async Task Suggestions_RanksMutualFriendsBeforeVibes()
    {
        var callerId = Guid.NewGuid();
        var mutualId = Guid.NewGuid();
        var mutualCandidateId = Guid.NewGuid();
        var vibeCandidateId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            CreateUser(callerId, "caller", interestsJson: @"[""food""]", homeBase: "Dallas, TX"),
            CreateUser(mutualId, "mutual"),
            CreateUser(mutualCandidateId, "mutualcandidate", interestsJson: @"[""nature""]"),
            CreateUser(vibeCandidateId, "vibecandidate", interestsJson: @"[""food""]"));
        dbContext.Friendships.AddRange(
            Accepted(callerId, mutualId),
            Accepted(mutualCandidateId, mutualId));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.Suggestions("best", 2, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        var items = Assert.IsAssignableFrom<IEnumerable<object>>(response.Data).ToList();
        Assert.Equal(mutualCandidateId, GetNestedGuid(items[0], "user", "id"));
        Assert.Equal(vibeCandidateId, GetNestedGuid(items[1], "user", "id"));
    }

    [Fact]
    public async Task Suggestions_ExcludesShowcaseUsers()
    {
        var callerId = Guid.NewGuid();
        var showcaseId = Guid.NewGuid();
        var visibleCandidateId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            CreateUser(callerId, "caller", interestsJson: @"[""food""]"),
            CreateUser(showcaseId, "showcase", interestsJson: @"[""food""]", isShowcase: true),
            CreateUser(visibleCandidateId, "visible", interestsJson: @"[""food""]"));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.Suggestions("best", 8, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        var items = Assert.IsAssignableFrom<IEnumerable<object>>(response.Data).ToList();
        Assert.Single(items);
        Assert.Equal(visibleCandidateId, GetNestedGuid(items[0], "user", "id"));
    }

    [Fact]
    public async Task Suggestions_HidesPresence_WhenPlanningContextHidden()
    {
        var callerId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            CreateUser(callerId, "caller"),
            CreateUser(candidateId, "candidate"));
        dbContext.UserPresences.Add(new UserPresence
        {
            UserId = candidateId,
            Status = "online",
            LastActiveAt = DateTimeOffset.UtcNow,
            LastPlanningAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.Suggestions("best", 8, CancellationToken.None);

        var item = Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(
            Assert.IsType<ApiResponse<object>>(Assert.IsType<OkObjectResult>(result).Value).Data));
        Assert.Equal("hidden", GetString(item, "presence"));
        Assert.Equal(0, item.GetType().GetProperty("score")?.GetValue(item));
    }

    [Fact]
    public async Task CreateRequest_AllowsDirectShowcaseProfileRequest()
    {
        var callerId = Guid.NewGuid();
        var showcaseId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            CreateUser(callerId, "caller"),
            CreateUser(showcaseId, "showcase", isShowcase: true));
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.CreateRequest(showcaseId, CancellationToken.None);

        var created = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);
        var friendship = await dbContext.Friendships.SingleAsync();
        Assert.Equal(callerId, friendship.RequesterId);
        Assert.Equal(showcaseId, friendship.AddresseeId);
        Assert.Equal("pending", friendship.Status);
    }

    [Fact]
    public async Task CreateRequest_RejectsWhenEitherUserBlocked()
    {
        var callerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            CreateUser(callerId, "caller"),
            CreateUser(targetId, "target"));
        dbContext.UserBlocks.Add(new UserBlock
        {
            Id = Guid.NewGuid(),
            BlockerId = targetId,
            BlockedId = callerId,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.CreateRequest(targetId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
        Assert.Empty(dbContext.Friendships);
        Assert.Empty(dbContext.Notifications);
    }

    private static CoreDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CoreDbContext(options);
    }

    private static User CreateUser(
        Guid userId,
        string username,
        bool showActivityStatus = true,
        string? interestsJson = null,
        string? homeBase = null,
        bool isShowcase = false) => new()
    {
        Id = userId,
        Username = username,
        Email = $"{username}@example.com",
        DisplayName = username,
        PasswordHash = "hash",
        IsActive = true,
        IsShowcase = isShowcase,
        ShowActivityStatus = showActivityStatus,
        InterestsJson = interestsJson,
        HomeBase = homeBase,
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static Friendship Accepted(Guid requesterId, Guid addresseeId) => new()
    {
        Id = Guid.NewGuid(),
        RequesterId = requesterId,
        AddresseeId = addresseeId,
        Status = "accepted",
        CreatedAt = DateTimeOffset.UtcNow,
    };

    private static FriendsController CreateController(CoreDbContext dbContext, Guid userId)
        => new(dbContext, new NoopKafkaProducerService())
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

    private static string GetString(object payload, string property)
        => (string)(payload.GetType().GetProperty(property)?.GetValue(payload) ?? throw new InvalidOperationException(property));

    private static Guid GetNestedGuid(object payload, string property, string nestedProperty)
    {
        var nested = payload.GetType().GetProperty(property)?.GetValue(payload) ?? throw new InvalidOperationException(property);
        return (Guid)(nested.GetType().GetProperty(nestedProperty)?.GetValue(nested) ?? throw new InvalidOperationException(nestedProperty));
    }

    private sealed class NoopKafkaProducerService : IKafkaProducerService
    {
        public Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
