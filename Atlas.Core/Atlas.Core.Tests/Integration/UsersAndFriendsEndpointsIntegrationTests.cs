using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class UsersEndpointsIntegrationTests
{
    [Fact]
    public async Task UsersEndpoints_HappyPath_CoversGetSearchUpdateAvatarStatsAndDelete()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        var friend = TestSupport.CreateUser(username: "friend", email: "friend@example.com", displayName: "Friend User");
        await factory.SeedAsync(db =>
        {
            db.Users.AddRange(user, friend);
            db.Friendships.Add(new Friendship
            {
                Id = Guid.NewGuid(),
                RequesterId = user.Id,
                AddresseeId = friend.Id,
                Status = FriendshipStatuses.Accepted,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
            });
        });
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);

        var getResponse = await client.GetAsync($"/api/core/users/{user.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var searchResponse = await client.GetAsync("/api/core/users/search?q=Friend");
        Assert.Equal(HttpStatusCode.OK, searchResponse.StatusCode);
        var searchPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(searchResponse);
        Assert.Contains("Friend User", searchPayload.Data.ToString(), StringComparison.Ordinal);

        var updateResponse = await client.PutAsJsonAsync($"/api/core/users/{user.Id}", new
        {
            displayName = "Updated User",
            bio = "Updated bio"
        });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using var avatarContent = EndpointIntegrationTestHelpers.CreateAvatarContent([1, 2, 3, 4]);
        var avatarResponse = await client.PutAsync($"/api/core/users/{user.Id}/avatar", avatarContent);
        Assert.Equal(HttpStatusCode.OK, avatarResponse.StatusCode);

        var statsResponse = await client.GetAsync($"/api/core/users/{user.Id}/stats");
        Assert.Equal(HttpStatusCode.OK, statsResponse.StatusCode);
        var statsPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(statsResponse);
        Assert.Equal(1, statsPayload.Data.GetProperty("friends").GetInt32());

        var deleteResponse = await client.DeleteAsync($"/api/core/users/{user.Id}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        var isActive = await factory.ExecuteDbContextAsync(async db => (await db.Users.FindAsync(user.Id))!.IsActive);
        Assert.False(isActive);
    }

    [Fact]
    public async Task UsersEndpoints_ErrorPaths_ReturnExpectedStatusCodes()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var currentUser = TestSupport.CreateUser();
        var otherUser = TestSupport.CreateUser(username: "other", email: "other@example.com", displayName: "Other User");
        await factory.SeedAsync(db => db.Users.AddRange(currentUser, otherUser));
        using var client = factory.CreateAuthenticatedClient(currentUser.Id, currentUser.Email, currentUser.DisplayName, currentUser.Role);

        var missingGet = await client.GetAsync($"/api/core/users/{Guid.NewGuid()}");
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingGet, StatusCodes.Status404NotFound, "NOT_FOUND");

        var forbiddenUpdate = await client.PutAsJsonAsync($"/api/core/users/{otherUser.Id}", new
        {
            displayName = "Nope",
            bio = "Nope"
        });
        await EndpointIntegrationTestHelpers.AssertErrorAsync(forbiddenUpdate, StatusCodes.Status403Forbidden, "FORBIDDEN");

        using var invalidAvatarContent = EndpointIntegrationTestHelpers.CreateAvatarContent([1, 2, 3, 4], "avatar.gif", "image/gif");
        var invalidAvatar = await client.PutAsync($"/api/core/users/{currentUser.Id}/avatar", invalidAvatarContent);
        await EndpointIntegrationTestHelpers.AssertErrorAsync(invalidAvatar, StatusCodes.Status400BadRequest, "VALIDATION_ERROR");

        var missingStats = await client.GetAsync($"/api/core/users/{Guid.NewGuid()}/stats");
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingStats, StatusCodes.Status404NotFound, "NOT_FOUND");
    }
}

public sealed class FriendsEndpointsIntegrationTests
{
    [Fact]
    public async Task FriendsEndpoints_HappyPath_CoversRequestPendingAcceptListDeleteDeclineAndBlock()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var requester = TestSupport.CreateUser();
        var addressee = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        await factory.SeedAsync(db => db.Users.AddRange(requester, addressee));
        using var requesterClient = factory.CreateAuthenticatedClient(requester.Id, requester.Email, requester.DisplayName, requester.Role);
        using var addresseeClient = factory.CreateAuthenticatedClient(addressee.Id, addressee.Email, addressee.DisplayName, addressee.Role);

        var requestResponse = await requesterClient.PostAsync($"/api/core/friends/request/{addressee.Id}", null);
        Assert.Equal(HttpStatusCode.Created, requestResponse.StatusCode);
        var createdFriendship = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(requestResponse);
        var firstFriendshipId = createdFriendship.Data.GetProperty("id").GetGuid();

        var pendingResponse = await addresseeClient.GetAsync("/api/core/friends/pending");
        Assert.Equal(HttpStatusCode.OK, pendingResponse.StatusCode);
        Assert.Contains(requester.Id.ToString(), (await EndpointIntegrationTestHelpers.ReadApiResponseAsync(pendingResponse)).Data.ToString(), StringComparison.Ordinal);

        var acceptResponse = await addresseeClient.PutAsync($"/api/core/friends/{firstFriendshipId}/accept", JsonContent.Create(new { }));
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        var listResponse = await requesterClient.GetAsync("/api/core/friends");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Contains(addressee.Id.ToString(), (await EndpointIntegrationTestHelpers.ReadApiResponseAsync(listResponse)).Data.ToString(), StringComparison.Ordinal);

        var deleteResponse = await requesterClient.DeleteAsync($"/api/core/friends/{firstFriendshipId}");
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);

        var secondRequestResponse = await requesterClient.PostAsync($"/api/core/friends/request/{addressee.Id}", null);
        Assert.Equal(HttpStatusCode.Created, secondRequestResponse.StatusCode);
        var secondFriendshipId = (await EndpointIntegrationTestHelpers.ReadApiResponseAsync(secondRequestResponse)).Data.GetProperty("id").GetGuid();

        var declineResponse = await addresseeClient.PutAsync($"/api/core/friends/{secondFriendshipId}/decline", JsonContent.Create(new { }));
        Assert.Equal(HttpStatusCode.OK, declineResponse.StatusCode);

        var blockResponse = await requesterClient.PostAsync($"/api/core/friends/{addressee.Id}/block", null);
        Assert.Equal(HttpStatusCode.OK, blockResponse.StatusCode);
        var blockedStatus = await factory.ExecuteDbContextAsync(async db => (await db.Friendships.FindAsync(secondFriendshipId))!.Status);
        Assert.Equal(FriendshipStatuses.Blocked, blockedStatus);
    }

    [Fact]
    public async Task FriendsEndpoints_ErrorPaths_ReturnExpectedStatusCodes()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var requester = TestSupport.CreateUser();
        var addressee = TestSupport.CreateUser(username: "target", email: "target@example.com", displayName: "Target User");
        var thirdUser = TestSupport.CreateUser(username: "third", email: "third@example.com", displayName: "Third User");
        var pendingFriendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = addressee.Id,
            Status = FriendshipStatuses.Pending,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };
        var acceptedFriendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requester.Id,
            AddresseeId = thirdUser.Id,
            Status = FriendshipStatuses.Accepted,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-2)
        };
        await factory.SeedAsync(db =>
        {
            db.Users.AddRange(requester, addressee, thirdUser);
            db.Friendships.AddRange(pendingFriendship, acceptedFriendship);
        });
        using var requesterClient = factory.CreateAuthenticatedClient(requester.Id, requester.Email, requester.DisplayName, requester.Role);
        using var addresseeClient = factory.CreateAuthenticatedClient(addressee.Id, addressee.Email, addressee.DisplayName, addressee.Role);

        var selfRequest = await requesterClient.PostAsync($"/api/core/friends/request/{requester.Id}", null);
        await EndpointIntegrationTestHelpers.AssertErrorAsync(selfRequest, StatusCodes.Status400BadRequest, "VALIDATION_ERROR");

        var duplicateRequest = await requesterClient.PostAsync($"/api/core/friends/request/{addressee.Id}", null);
        await EndpointIntegrationTestHelpers.AssertErrorAsync(duplicateRequest, StatusCodes.Status409Conflict, "CONFLICT");

        var forbiddenAccept = await requesterClient.PutAsync($"/api/core/friends/{pendingFriendship.Id}/accept", JsonContent.Create(new { }));
        await EndpointIntegrationTestHelpers.AssertErrorAsync(forbiddenAccept, StatusCodes.Status403Forbidden, "FORBIDDEN");

        var invalidDecline = await addresseeClient.PutAsync($"/api/core/friends/{acceptedFriendship.Id}/decline", JsonContent.Create(new { }));
        await EndpointIntegrationTestHelpers.AssertErrorAsync(invalidDecline, StatusCodes.Status403Forbidden, "FORBIDDEN");

        var missingDelete = await requesterClient.DeleteAsync($"/api/core/friends/{Guid.NewGuid()}");
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingDelete, StatusCodes.Status404NotFound, "NOT_FOUND");

        var selfBlock = await requesterClient.PostAsync($"/api/core/friends/{requester.Id}/block", null);
        await EndpointIntegrationTestHelpers.AssertErrorAsync(selfBlock, StatusCodes.Status400BadRequest, "VALIDATION_ERROR");
    }
}
