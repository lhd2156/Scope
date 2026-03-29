using System.Net;
using System.Net.Http.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Entities;
using Atlas.Core.Infrastructure.Services;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Atlas.Core.Tests.Integration;

[Collection(PasswordResetTicketCollections.SharedPasswordResetTickets)]
public sealed class AuthEndpointsIntegrationTests
{
    [Fact]
    public async Task Register_HappyPathAndDuplicateConflict_AreHandledThroughHttpPipeline()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var createdResponse = await client.PostAsJsonAsync("/api/core/auth/register", new
        {
            username = "louis",
            email = "louis@example.com",
            password = "SecurePass123!",
            displayName = "Louis Do"
        });

        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var createdPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(createdResponse);
        Assert.Equal("louis@example.com", createdPayload.Data.GetProperty("email").GetString());
        Assert.Equal(1, await factory.ExecuteDbContextAsync(db => Task.FromResult(db.Users.Count())));

        var conflictResponse = await client.PostAsJsonAsync("/api/core/auth/register", new
        {
            username = "louis-2",
            email = "louis@example.com",
            password = "SecurePass123!",
            displayName = "Louis Two"
        });

        await EndpointIntegrationTestHelpers.AssertErrorAsync(conflictResponse, StatusCodes.Status409Conflict, "CONFLICT");
    }

    [Fact]
    public async Task Login_HappyPathAndInvalidCredentials_ReturnExpectedResponses()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var passwordHasher = new PasswordHasherService();
        await factory.SeedAsync(db =>
        {
            db.Users.Add(TestSupport.CreateUser(passwordHash: passwordHasher.Hash("SecurePass123!")));
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var successResponse = await client.PostAsJsonAsync("/api/core/auth/login", new
        {
            email = "louis@example.com",
            password = "SecurePass123!"
        });

        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);
        var successPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(successResponse);
        Assert.False(string.IsNullOrWhiteSpace(successPayload.Data.GetProperty("accessToken").GetString()));

        var invalidResponse = await client.PostAsJsonAsync("/api/core/auth/login", new
        {
            email = "louis@example.com",
            password = "WrongPassword!"
        });

        await EndpointIntegrationTestHelpers.AssertErrorAsync(invalidResponse, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task Refresh_HappyPathAndInvalidToken_ReturnExpectedResponses()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db =>
        {
            db.Users.Add(user);
            db.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                User = user,
                Token = "refresh-token",
                CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-30),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
            });
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var successResponse = await client.PostAsJsonAsync("/api/core/auth/refresh", new { refreshToken = "refresh-token" });

        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);
        var tokenCount = await factory.ExecuteDbContextAsync(db => Task.FromResult(db.RefreshTokens.Count()));
        Assert.Equal(2, tokenCount);

        var invalidResponse = await client.PostAsJsonAsync("/api/core/auth/refresh", new { refreshToken = "missing-token" });
        await EndpointIntegrationTestHelpers.AssertErrorAsync(invalidResponse, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task Logout_HappyPathAndValidationFailure_AreReturnedOverHttp()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db =>
        {
            db.Users.Add(user);
            db.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                User = user,
                Token = "refresh-token",
                CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-30),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
            });
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var successResponse = await client.PostAsJsonAsync("/api/core/auth/logout", new { refreshToken = "refresh-token" });

        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);
        var revokedAt = await factory.ExecuteDbContextAsync(async db => (await db.RefreshTokens.SingleAsync()).RevokedAt);
        Assert.NotNull(revokedAt);

        var validationResponse = await client.PostAsJsonAsync("/api/core/auth/logout", new { });
        await EndpointIntegrationTestHelpers.AssertErrorAsync(validationResponse, StatusCodes.Status400BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ForgotPassword_HappyPathAndValidationFailure_AreHandled()
    {
        using var factory = new ApiTestWebApplicationFactory();
        await factory.SeedAsync(db => db.Users.Add(TestSupport.CreateUser()));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var successResponse = await client.PostAsJsonAsync("/api/core/auth/forgot-password", new { email = "louis@example.com" });
        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);

        var validationResponse = await client.PostAsJsonAsync("/api/core/auth/forgot-password", new { email = string.Empty });
        await EndpointIntegrationTestHelpers.AssertErrorAsync(validationResponse, StatusCodes.Status400BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task ResetPassword_HappyPathAndInvalidToken_AreHandled()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var passwordHasher = new PasswordHasherService();
        var user = TestSupport.CreateUser(passwordHash: passwordHasher.Hash("OldPassword123!"));
        await factory.SeedAsync(db =>
        {
            db.Users.Add(user);
            db.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                User = user,
                Token = "active-refresh-token",
                CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
            });
        });
        EndpointIntegrationTestHelpers.StorePasswordResetTicket("valid-reset-token", user.Id);
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var successResponse = await client.PostAsJsonAsync("/api/core/auth/reset-password", new
        {
            token = "valid-reset-token",
            password = "NewPassword123!"
        });

        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);
        var updatedHash = await factory.ExecuteDbContextAsync(async db => (await db.Users.SingleAsync()).PasswordHash);
        Assert.True(passwordHasher.Verify("NewPassword123!", updatedHash));

        var invalidResponse = await client.PostAsJsonAsync("/api/core/auth/reset-password", new
        {
            token = "missing-token",
            password = "NewPassword123!"
        });

        await EndpointIntegrationTestHelpers.AssertErrorAsync(invalidResponse, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task Cognito_HappyPathAndValidationFailure_AreHandled()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var successResponse = await client.PostAsJsonAsync("/api/core/auth/oauth/cognito", new
        {
            email = "cognito@example.com",
            username = "Cognito.User",
            displayName = "Cognito User",
            subject = "subject-123"
        });

        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);
        Assert.Equal(1, await factory.ExecuteDbContextAsync(db => Task.FromResult(db.Users.Count())));

        var validationResponse = await client.PostAsJsonAsync("/api/core/auth/oauth/cognito", new
        {
            email = string.Empty,
            username = "bad-user",
            displayName = "Bad User",
            subject = "subject-456"
        });

        await EndpointIntegrationTestHelpers.AssertErrorAsync(validationResponse, StatusCodes.Status400BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task Me_HappyPathAndMissingUser_ReturnExpectedResponses()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db => db.Users.Add(user));

        using var successClient = factory.CreateAuthenticatedClient(user.Id);
        var successResponse = await successClient.GetAsync("/api/core/auth/me");

        Assert.Equal(HttpStatusCode.OK, successResponse.StatusCode);
        var successPayload = await EndpointIntegrationTestHelpers.ReadApiResponseAsync(successResponse);
        Assert.Equal(user.Id.ToString(), successPayload.Data.GetProperty("id").GetString());

        using var missingUserClient = factory.CreateAuthenticatedClient(Guid.NewGuid());
        var missingUserResponse = await missingUserClient.GetAsync("/api/core/auth/me");
        await EndpointIntegrationTestHelpers.AssertErrorAsync(missingUserResponse, StatusCodes.Status404NotFound, "NOT_FOUND");
    }
}
