using System.Net;
using System.Net.Http.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class ResponseCachingIntegrationTests
{
    [Fact]
    public async Task UserProfileReadEndpoint_ReturnsEntityTagAnd304ForMatchingIfNoneMatch()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db => db.Users.Add(user));
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);

        var firstResponse = await client.GetAsync($"/api/core/users/{user.Id}");

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.True(firstResponse.Headers.TryGetValues(CoreCaching.EntityTagHeaderName, out var entityTagValues));
        Assert.NotNull(firstResponse.Headers.CacheControl);
        Assert.True(firstResponse.Headers.CacheControl!.Private);
        Assert.True(firstResponse.Headers.CacheControl!.NoCache);
        Assert.Contains(CoreCaching.VaryAuthorizationValue, firstResponse.Headers.Vary, StringComparer.OrdinalIgnoreCase);
        var entityTag = entityTagValues.Single();

        using var conditionalRequest = new HttpRequestMessage(HttpMethod.Get, $"/api/core/users/{user.Id}");
        conditionalRequest.Headers.Authorization = client.DefaultRequestHeaders.Authorization;
        conditionalRequest.Headers.TryAddWithoutValidation(CoreCaching.IfNoneMatchHeaderName, entityTag);
        var secondResponse = await client.SendAsync(conditionalRequest);

        Assert.Equal(HttpStatusCode.NotModified, secondResponse.StatusCode);
        Assert.Equal(entityTag, secondResponse.Headers.GetValues(CoreCaching.EntityTagHeaderName).Single());
        Assert.Equal(string.Empty, await secondResponse.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task NotificationUnreadCount_EmitsNewEntityTagWhenUnderlyingDataChanges()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Type = NotificationTypes.FriendRequest,
            Title = "Request",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        };
        await factory.SeedAsync(db =>
        {
            db.Users.Add(user);
            db.Notifications.Add(notification);
        });
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);

        var beforeResponse = await client.GetAsync("/api/core/notifications/unread-count");
        var beforeEntityTag = beforeResponse.Headers.GetValues(CoreCaching.EntityTagHeaderName).Single();

        var readAllResponse = await client.PutAsJsonAsync("/api/core/notifications/read-all", new { });
        Assert.Equal(HttpStatusCode.OK, readAllResponse.StatusCode);

        var afterResponse = await client.GetAsync("/api/core/notifications/unread-count");
        var afterEntityTag = afterResponse.Headers.GetValues(CoreCaching.EntityTagHeaderName).Single();

        Assert.NotEqual(beforeEntityTag, afterEntityTag);
    }

    [Fact]
    public async Task HealthEndpoint_DoesNotEmitEntityTagHeaders()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync("/api/core/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains(CoreCaching.EntityTagHeaderName));
    }
}
