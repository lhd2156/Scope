using System.Security.Claims;
using Scope.Core.API.Controllers;
using Scope.Core.Domain.Entities;
using Scope.Core.Domain.Models;
using Scope.Core.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Scope.Core.Tests.Controllers;

public sealed class NotificationsControllerTests
{
    [Fact]
    public async Task List_UsesNameIdentifierClaim_WhenSubClaimIsMissing()
    {
        var userId = Guid.NewGuid();
        var options = new DbContextOptionsBuilder<CoreDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var dbContext = new CoreDbContext(options);
        dbContext.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = "system",
            Title = "Welcome",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var controller = new NotificationsController(dbContext)
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

        var result = await controller.List(cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ApiResponse<object>>(ok.Value);
        var items = Assert.IsAssignableFrom<IEnumerable<Notification>>(response.Data);
        Assert.Single(items);
    }

    [Fact]
    public async Task Delete_RemovesOnlyCallerOwnedNotification()
    {
        var userId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();
        var options = new DbContextOptionsBuilder<CoreDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var dbContext = new CoreDbContext(options);
        dbContext.Notifications.Add(new Notification
        {
            Id = notificationId,
            UserId = userId,
            Type = "system",
            Title = "Welcome",
            CreatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var controller = new NotificationsController(dbContext)
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

        var result = await controller.Delete(notificationId, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.Empty(await dbContext.Notifications.ToListAsync());
    }
}
