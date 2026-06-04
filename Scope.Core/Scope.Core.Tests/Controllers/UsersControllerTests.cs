using System.Security.Claims;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class UsersControllerTests
{
    [Fact]
    public async Task Update_AllowsCallerToEditOwnProfile()
    {
        var userId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(new User
        {
            Id = userId,
            Username = "louis",
            Email = "louis@example.com",
            DisplayName = "Louis",
            PasswordHash = "hash",
            IsActive = true,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);

        var result = await controller.Update(
            userId,
            new UserProfileUpdateRequest(
                DisplayName: "Louis Do",
                Bio: "  Local explorer  ",
                AvatarUrl: "",
                HomeBase: "Dallas, TX",
                Interests: new[] { "food", "culture" },
                ShowActivityStatus: false),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        Assert.NotNull(response.Data);
        var user = await dbContext.Users.SingleAsync(x => x.Id == userId);
        Assert.Equal("Louis Do", user.DisplayName);
        Assert.Equal("Local explorer", user.Bio);
        Assert.Null(user.AvatarUrl);
        Assert.Equal("Dallas, TX", user.HomeBase);
        Assert.Equal(@"[""food"",""culture""]", user.InterestsJson);
        Assert.False(user.ShowActivityStatus);
    }

    [Fact]
    public async Task Stats_ReturnsPrivateCounts_ForCaller()
    {
        var userId = Guid.NewGuid();
        var friendId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            new User
            {
                Id = userId,
                Username = "louis",
                Email = "louis@example.com",
                DisplayName = "Louis",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            },
            new User
            {
                Id = friendId,
                Username = "friend",
                Email = "friend@example.com",
                DisplayName = "Friend",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = userId,
            AddresseeId = friendId,
            Status = "accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "system",
            Title = "Unread",
            IsRead = false,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = Guid.NewGuid(),
            UserId = userId,
            Latitude = 32.75,
            Longitude = -97.33,
            IsActive = true,
            LastPingAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, userId);

        var result = await controller.Stats(userId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        Assert.NotNull(response.Data);
        var payload = response.Data!;
        Assert.Equal(1, GetInt(payload, "friendsCount"));
        Assert.Equal(1, GetInt(payload, "unreadNotifications"));
        Assert.Equal(1, GetInt(payload, "activeLiveSessions"));
    }

    [Fact]
    public async Task Get_DoesNotExposeEmail_ForDifferentUser()
    {
        var callerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            new User
            {
                Id = callerId,
                Username = "caller",
                Email = "caller@example.com",
                DisplayName = "Caller",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            },
            new User
            {
                Id = targetId,
                Username = "target",
                Email = "target@example.com",
                DisplayName = "Target",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.Get(targetId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        Assert.NotNull(response.Data);
        Assert.Equal(string.Empty, response.Data!.GetType().GetProperty("Email")?.GetValue(response.Data));
    }

    [Fact]
    public async Task Search_DoesNotMatchOrReturnEmail()
    {
        var callerId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            new User
            {
                Id = callerId,
                Username = "caller",
                Email = "caller@example.com",
                DisplayName = "Caller",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            },
            new User
            {
                Id = Guid.NewGuid(),
                Username = "not-a-secret",
                Email = "private-match@example.com",
                DisplayName = "Public Name",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var result = await controller.Search("private-match", cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        var items = Assert.IsAssignableFrom<IEnumerable<object>>(response.Data);
        Assert.Empty(items);
    }

    private static CoreDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<CoreDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new CoreDbContext(options);
    }

    private static UsersController CreateController(CoreDbContext dbContext, Guid userId)
        => new(dbContext)
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

    private static int GetInt(object payload, string property)
        => (int)(payload.GetType().GetProperty(property)?.GetValue(payload) ?? throw new InvalidOperationException(property));
}
