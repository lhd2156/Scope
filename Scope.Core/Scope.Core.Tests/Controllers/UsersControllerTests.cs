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
                ShowActivityStatus: false,
                ProfileVisibility: "private"),
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
        Assert.Equal("private", user.ProfileVisibility);
    }

    [Fact]
    public async Task Get_RedactsStreetAddressAndFriendsOnlyContext_ForNonOwner()
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
                Bio = "Private planning context",
                HomeBase = "7620 Deaver Drive, North Richland Hills, TX",
                InterestsJson = """["food"]""",
                ProfileVisibility = "friends",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);
        var hiddenResult = await controller.Get(targetId, CancellationToken.None);
        var hiddenPayload = Assert.IsType<ApiResponse<object>>(
            Assert.IsType<OkObjectResult>(hiddenResult).Value).Data;
        Assert.Null(hiddenPayload.GetType().GetProperty("HomeBase")?.GetValue(hiddenPayload));
        Assert.Null(hiddenPayload.GetType().GetProperty("Bio")?.GetValue(hiddenPayload));
        Assert.Empty(Assert.IsAssignableFrom<IEnumerable<string>>(
            hiddenPayload.GetType().GetProperty("Interests")?.GetValue(hiddenPayload)));

        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = callerId,
            AddresseeId = targetId,
            Status = "accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var visibleResult = await controller.Get(targetId, CancellationToken.None);
        var visiblePayload = Assert.IsType<ApiResponse<object>>(
            Assert.IsType<OkObjectResult>(visibleResult).Value).Data;
        Assert.Equal(
            "North Richland Hills, TX",
            visiblePayload.GetType().GetProperty("HomeBase")?.GetValue(visiblePayload));
        Assert.Equal("Private planning context", visiblePayload.GetType().GetProperty("Bio")?.GetValue(visiblePayload));
    }

    [Fact]
    public async Task Search_ExcludesPrivateProfilesAndRejectsInvalidVisibility()
    {
        var callerId = Guid.NewGuid();
        var privateId = Guid.NewGuid();
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
                Id = privateId,
                Username = "hidden",
                Email = "hidden@example.com",
                DisplayName = "Hidden Traveler",
                ProfileVisibility = "private",
                PasswordHash = "hash",
                IsActive = true,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);
        var searchResult = await controller.Search("Hidden", cancellationToken: CancellationToken.None);
        var searchItems = Assert.IsAssignableFrom<IEnumerable<object>>(
            Assert.IsType<ApiResponse<object>>(Assert.IsType<OkObjectResult>(searchResult).Value).Data);
        Assert.Empty(searchItems);

        var updateResult = await controller.Update(
            callerId,
            new UserProfileUpdateRequest(ProfileVisibility: "everyone"),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(updateResult);
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

    [Fact]
    public async Task Search_HidesShowcaseUsers_ButGetAllowsPublicProfile()
    {
        var callerId = Guid.NewGuid();
        var showcaseId = Guid.NewGuid();
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
                Id = showcaseId,
                Username = "showcaseauthor",
                Email = "showcase@example.com",
                DisplayName = "Showcase Author",
                PasswordHash = "hash",
                IsActive = true,
                IsShowcase = true,
                CreatedAt = DateTimeOffset.UtcNow,
            });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, callerId);

        var searchResult = await controller.Search("Showcase", cancellationToken: CancellationToken.None);
        var searchOk = Assert.IsType<OkObjectResult>(searchResult);
        var searchResponse = Assert.IsType<ApiResponse<object>>(searchOk.Value);
        Assert.Empty(Assert.IsAssignableFrom<IEnumerable<object>>(searchResponse.Data));

        var getResult = await controller.Get(showcaseId, CancellationToken.None);
        var getOk = Assert.IsType<OkObjectResult>(getResult);
        var getResponse = Assert.IsType<ApiResponse<object>>(getOk.Value);
        Assert.NotNull(getResponse.Data);
        Assert.Equal("Showcase Author", getResponse.Data!.GetType().GetProperty("DisplayName")?.GetValue(getResponse.Data));
    }

    [Fact]
    public async Task Deactivate_ScrubsAccountAndRemovesCoreSessionAndSocialData()
    {
        var userId = Guid.NewGuid();
        var friendId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.AddRange(
            new User
            {
                Id = userId,
                Username = "delete-me",
                Email = "delete-me@example.com",
                PhoneNumber = "+1 555 0100",
                DisplayName = "Delete Me",
                PasswordHash = "hash",
                Bio = "Sensitive bio",
                AvatarUrl = "https://example.com/avatar.png",
                HomeBase = "7620 Deaver Drive, North Richland Hills, TX",
                InterestsJson = """["food"]""",
                MfaEnabled = true,
                MfaSecret = "secret",
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
        dbContext.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = "refresh-token",
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(1),
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
            Id = notificationId,
            UserId = friendId,
            ActorUserId = userId,
            Type = "friend.accepted",
            TemplateKey = "friend.accepted",
            Title = "Friend accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.NotificationDeliveries.Add(new NotificationDelivery
        {
            Id = Guid.NewGuid(),
            NotificationId = notificationId,
            UserId = friendId,
            Channel = "in_app",
            Status = "pending",
            NextAttemptAt = DateTimeOffset.UtcNow,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.UserPresences.Add(new UserPresence
        {
            UserId = userId,
            Status = "online",
            LastActiveAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var result = await CreateController(dbContext, userId).Deactivate(userId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        var deletedUser = await dbContext.Users.SingleAsync(x => x.Id == userId);
        Assert.False(deletedUser.IsActive);
        Assert.StartsWith("deleted-", deletedUser.Username);
        Assert.StartsWith("deleted+", deletedUser.Email);
        Assert.Equal("Deleted traveler", deletedUser.DisplayName);
        Assert.Null(deletedUser.PhoneNumber);
        Assert.Null(deletedUser.Bio);
        Assert.Null(deletedUser.AvatarUrl);
        Assert.Null(deletedUser.HomeBase);
        Assert.False(deletedUser.MfaEnabled);
        Assert.Empty(dbContext.RefreshTokens);
        Assert.Empty(dbContext.Friendships);
        Assert.Empty(dbContext.Notifications);
        Assert.Empty(dbContext.NotificationDeliveries);
        Assert.Empty(dbContext.UserPresences);
    }

    [Fact]
    public async Task Deactivate_RejectsDifferentNonAdminUserAndMissingAccount()
    {
        var callerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await using var dbContext = CreateDbContext();
        dbContext.Users.Add(new User
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
        Assert.IsType<ForbidResult>(await controller.Deactivate(targetId, CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.Deactivate(callerId, CancellationToken.None));
        Assert.True((await dbContext.Users.SingleAsync()).IsActive);
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
