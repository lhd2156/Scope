using System.Security.Claims;
using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class UsersControllerCoveragePushTests
{
    [Fact]
    public async Task UsersController_CoversValidationMissingAndShortSearchBranches()
    {
        var callerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.Add(TestData.User(callerId, "caller", interestsJson: "not-json"));
        await dbContext.SaveChangesAsync();
        var controller = new UsersController(dbContext).WithUser(callerId);

        Assert.IsType<NotFoundObjectResult>(await controller.Get(Guid.NewGuid(), CancellationToken.None));
        Assert.IsType<ForbidResult>(await controller.Update(otherId, new UserProfileUpdateRequest(DisplayName: "Other"), CancellationToken.None));
        var missingUserId = Guid.NewGuid();
        Assert.IsType<NotFoundObjectResult>(await new UsersController(dbContext).WithUser(missingUserId)
            .Update(missingUserId, new UserProfileUpdateRequest(DisplayName: "Other"), CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.Update(callerId, new UserProfileUpdateRequest(DisplayName: "x"), CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await controller.Stats(Guid.NewGuid(), CancellationToken.None));

        var shortSearch = await controller.Search("@ a ", cancellationToken: CancellationToken.None);
        var shortItems = Assert.IsAssignableFrom<IEnumerable<object>>(TestData.Response(Assert.IsType<OkObjectResult>(shortSearch)).Data);
        Assert.Empty(shortItems);

        var profile = await controller.Get(callerId, CancellationToken.None);
        var payload = TestData.Response(Assert.IsType<OkObjectResult>(profile)).Data;
        Assert.Empty(TestData.Prop<IReadOnlyList<string>>(payload, "Interests"));

        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = otherId,
            AddresseeId = callerId,
            Status = "pending",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = callerId,
            Type = "n",
            TemplateKey = "n",
            Category = "general",
            Priority = "normal",
            Title = "n",
            IsRead = false,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.LiveSessions.Add(new LiveSession
        {
            Id = Guid.NewGuid(),
            TripId = Guid.NewGuid(),
            UserId = callerId,
            Latitude = 41.0,
            Longitude = -87.0,
            IsActive = true,
            LastPingAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var stats = await controller.Stats(callerId, CancellationToken.None);
        var statsPayload = TestData.Response(Assert.IsType<OkObjectResult>(stats)).Data;
        Assert.Equal(1, TestData.Prop<int>(statsPayload, "pendingFriendRequests"));
        Assert.Equal(1, TestData.Prop<int>(statsPayload, "unreadNotifications"));
        Assert.Equal(1, TestData.Prop<int>(statsPayload, "activeLiveSessions"));
    }

    [Fact]
    public async Task UsersController_HidesPrivateStatsAndLetsAdminsSearchExactEmail()
    {
        var callerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.AddRange(
            TestData.User(callerId, "caller", profileVisibility: "public"),
            TestData.User(targetId, "private", email: "private-target@example.com", displayName: "Private Target", profileVisibility: "private"),
            TestData.User(adminId, "admin", email: "admin@example.com", displayName: "Admin", profileVisibility: "public"));
        dbContext.Friendships.Add(new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = callerId,
            AddresseeId = targetId,
            Status = "accepted",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = targetId,
            Type = "n",
            TemplateKey = "n",
            Category = "general",
            Priority = "normal",
            Title = "n",
            IsRead = false,
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await dbContext.SaveChangesAsync();

        var callerStats = await new UsersController(dbContext).WithUser(callerId).Stats(targetId, CancellationToken.None);
        var statsPayload = TestData.Response(Assert.IsType<OkObjectResult>(callerStats)).Data;
        Assert.Equal(1, TestData.Prop<int>(statsPayload, "friendsCount"));
        Assert.Null(statsPayload.GetType().GetProperty("pendingFriendRequests")?.GetValue(statsPayload));
        Assert.Null(statsPayload.GetType().GetProperty("unreadNotifications")?.GetValue(statsPayload));
        Assert.Null(statsPayload.GetType().GetProperty("activeLiveSessions")?.GetValue(statsPayload));

        var adminSearch = await WithUserAndRoles(new UsersController(dbContext), adminId, "admin")
            .Search("private-target@example.com", page: -5, pageSize: 999, cancellationToken: CancellationToken.None);
        var adminResponse = TestData.Response(Assert.IsType<OkObjectResult>(adminSearch));
        var item = Assert.Single(Assert.IsAssignableFrom<IEnumerable<object>>(adminResponse.Data));
        Assert.Equal(targetId, TestData.Prop<Guid>(item, "Id"));
        Assert.Equal("private-target@example.com", TestData.Prop<string>(item, "Email"));
        Assert.Equal(50, TestData.Prop<int>(adminResponse.Meta!, "pageSize"));
    }

    [Fact]
    public async Task UsersController_UpdateTrimsAndSanitizesOptionalProfileFields()
    {
        var callerId = Guid.NewGuid();
        await using var dbContext = TestData.CreateDbContext();
        dbContext.Users.Add(TestData.User(callerId, "profile", interestsJson: """["old"]""", homeBase: "Old home"));
        await dbContext.SaveChangesAsync();

        var longInterest = new string('x', 80);
        var result = await new UsersController(dbContext).WithUser(callerId).Update(
            callerId,
            new UserProfileUpdateRequest(
                Bio: "   ",
                AvatarUrl: " https://cdn.example.com/avatar.png ",
                HomeBase: "   ",
                Interests: new[] { " Food ", "", longInterest, "food", null! }),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        var user = await dbContext.Users.SingleAsync(x => x.Id == callerId);
        Assert.Null(user.Bio);
        Assert.Equal("https://cdn.example.com/avatar.png", user.AvatarUrl);
        Assert.Null(user.HomeBase);
        Assert.Equal("""["Food","xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]""", user.InterestsJson);
    }

    private static UsersController WithUserAndRoles(UsersController controller, Guid userId, params string[] roles)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()) };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"))
            }
        };
        return controller;
    }
}
