using System.Net;
using System.Net.Http.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class CorrelationIdIntegrationTests
{
    [Fact]
    public async Task SuccessfulResponses_PreserveIncomingCorrelationIdHeader()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add(CoreLogging.CorrelationIdHeaderName, "success-correlation-id");

        var response = await client.GetAsync("/api/core/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("success-correlation-id", response.Headers.GetValues(CoreLogging.CorrelationIdHeaderName).Single());
    }

    [Fact]
    public async Task ErrorResponses_GenerateCorrelationIdHeaderAndAlignTraceId()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        var response = await client.GetAsync($"/api/core/users/{Guid.NewGuid()}");

        await EndpointIntegrationTestHelpers.AssertErrorAsync(response, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
        var correlationId = response.Headers.GetValues(CoreLogging.CorrelationIdHeaderName).Single();
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);
        Assert.Equal(correlationId, document.RootElement.GetProperty("error").GetProperty("traceId").GetString());
    }

    [Fact]
    public async Task UnauthorizedHubNegotiation_PreservesIncomingCorrelationIdHeaderAndTraceId()
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add(CoreLogging.CorrelationIdHeaderName, "hub-correlation-id");

        var response = await client.PostAsJsonAsync("/api/core/hubs/location/negotiate?negotiateVersion=1", new { protocol = "json", version = 1 });

        await EndpointIntegrationTestHelpers.AssertErrorAsync(response, StatusCodes.Status401Unauthorized, "UNAUTHORIZED");
        Assert.Equal("hub-correlation-id", response.Headers.GetValues(CoreLogging.CorrelationIdHeaderName).Single());
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);
        Assert.Equal("hub-correlation-id", document.RootElement.GetProperty("error").GetProperty("traceId").GetString());
    }
}
