using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class ErrorResponsesIntegrationTests
{
    [Fact]
    public async Task UnauthorizedProtectedRestRequests_ReturnStandardErrorEnvelope()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync($"/api/core/users/{Guid.NewGuid()}");

        await EndpointIntegrationTestHelpers.AssertErrorAsync(response, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task UnauthorizedSignalRNegotiateRequests_ReturnStandardErrorEnvelope()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.PostAsJsonAsync("/api/core/hubs/notifications/negotiate?negotiateVersion=1", new { protocol = "json", version = 1 });

        await EndpointIntegrationTestHelpers.AssertErrorAsync(response, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
    }

    [Fact]
    public async Task MissingApiRoutes_ReturnStandardErrorEnvelope()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync("/api/core/does-not-exist");

        await EndpointIntegrationTestHelpers.AssertErrorAsync(response, StatusCodes.Status404NotFound, "NOT_FOUND");
    }

    [Fact]
    public async Task MalformedJsonPayloads_ReturnValidationErrorEnvelope()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        using var content = new StringContent("{\"email\":\"louis@example.com\",", Encoding.UTF8, "application/json");

        var response = await client.PostAsync("/api/core/auth/login", content);

        await EndpointIntegrationTestHelpers.AssertErrorAsync(response, StatusCodes.Status400BadRequest, "VALIDATION_ERROR");
    }

    [Fact]
    public async Task InvalidBearerTokens_ReturnStandardUnauthorizedEnvelope()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-valid-token");

        var response = await client.GetAsync($"/api/core/users/{Guid.NewGuid()}");

        await EndpointIntegrationTestHelpers.AssertErrorAsync(response, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
    }
}
