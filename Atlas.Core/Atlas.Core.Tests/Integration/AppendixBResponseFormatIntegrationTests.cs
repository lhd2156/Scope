using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Infrastructure.Services;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Atlas.Core.Tests.Integration;

[Collection(PasswordResetTicketCollections.SharedPasswordResetTickets)]
public sealed class AppendixBResponseFormatIntegrationTests
{
    [Fact]
    public async Task Register_Response_MatchesAppendixBShapeExactly()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.PostAsJsonAsync("/api/core/auth/register", new
        {
            username = "louisdo",
            email = "louis@example.com",
            password = "SecurePass123!",
            displayName = "Louis Do"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);

        EndpointIntegrationTestHelpers.AssertPropertyNames(document.RootElement, ["data"]);
        var data = document.RootElement.GetProperty("data");
        EndpointIntegrationTestHelpers.AssertPropertyNames(data, ["id", "username", "email", "displayName", "accessToken", "refreshToken"]);
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("id").GetString()));
        Assert.Equal("louisdo", data.GetProperty("username").GetString());
        Assert.Equal("louis@example.com", data.GetProperty("email").GetString());
        Assert.Equal("Louis Do", data.GetProperty("displayName").GetString());
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("refreshToken").GetString()));
    }

    [Fact]
    public async Task Login_Response_MatchesAppendixBShapeExactly()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var passwordHasher = new PasswordHasherService();
        await factory.SeedAsync(db =>
        {
            db.Users.Add(TestSupport.CreateUser(passwordHash: passwordHasher.Hash("SecurePass123!")));
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.PostAsJsonAsync("/api/core/auth/login", new
        {
            email = "louis@example.com",
            password = "SecurePass123!"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);

        EndpointIntegrationTestHelpers.AssertPropertyNames(document.RootElement, ["data"]);
        var data = document.RootElement.GetProperty("data");
        EndpointIntegrationTestHelpers.AssertPropertyNames(data, ["id", "username", "accessToken", "refreshToken"]);
        Assert.False(data.TryGetProperty("email", out _));
        Assert.False(data.TryGetProperty("displayName", out _));
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("id").GetString()));
        Assert.Equal("louis", data.GetProperty("username").GetString());
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("refreshToken").GetString()));
    }

    [Fact]
    public async Task Notifications_List_Response_UsesStandardPaginatedEnvelopeShape()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db =>
        {
            db.Users.Add(user);
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Type = "friend.request",
                Title = "New friend request",
                Body = "Someone wants to connect with you on Atlas.",
                ReferenceId = Guid.NewGuid().ToString(),
                IsRead = false,
                CreatedAt = DateTimeOffset.UtcNow
            });
        });

        using var client = factory.CreateAuthenticatedClient(user.Id);
        var response = await client.GetAsync("/api/core/notifications?page=1&pageSize=20");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);

        EndpointIntegrationTestHelpers.AssertPropertyNames(document.RootElement, ["data", "meta"]);
        Assert.Equal(JsonValueKind.Array, document.RootElement.GetProperty("data").ValueKind);
        var meta = document.RootElement.GetProperty("meta");
        EndpointIntegrationTestHelpers.AssertPropertyNames(meta, ["page", "pageSize", "total", "totalPages"]);
        Assert.Equal(1, meta.GetProperty("page").GetInt32());
        Assert.Equal(20, meta.GetProperty("pageSize").GetInt32());
        Assert.Equal(1, meta.GetProperty("total").GetInt32());
        Assert.Equal(1, meta.GetProperty("totalPages").GetInt32());
    }

    [Fact]
    public async Task Unauthorized_Response_MatchesStandardErrorEnvelopeExactly()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync("/api/core/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);

        EndpointIntegrationTestHelpers.AssertPropertyNames(document.RootElement, ["error"]);
        var error = document.RootElement.GetProperty("error");
        EndpointIntegrationTestHelpers.AssertPropertyNames(error, ["code", "message", "details", "traceId"]);
        Assert.Equal("UNAUTHORIZED", error.GetProperty("code").GetString());
        Assert.Equal(JsonValueKind.Array, error.GetProperty("details").ValueKind);
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("message").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("traceId").GetString()));
    }

    [Fact]
    public async Task Health_Response_RemainsBareArchitectureContract()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync("/api/core/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);

        EndpointIntegrationTestHelpers.AssertPropertyNames(document.RootElement, ["status", "version", "uptime"]);
        Assert.False(document.RootElement.TryGetProperty("data", out _));
        Assert.False(string.IsNullOrWhiteSpace(document.RootElement.GetProperty("status").GetString()));
        Assert.Equal("1.0.0", document.RootElement.GetProperty("version").GetString());
        Assert.True(document.RootElement.GetProperty("uptime").GetInt64() >= 0);
    }
}
