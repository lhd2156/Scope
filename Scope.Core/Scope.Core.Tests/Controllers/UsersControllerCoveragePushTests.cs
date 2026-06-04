using Scope.Core.API.Contracts.Requests;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
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
}
