using System.Net;
using System.Net.Http.Json;
using Atlas.Core.Tests.Infrastructure;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class SignalRHubNegotiationIntegrationTests
{
    [Theory]
    [InlineData("/api/core/hubs/trips/negotiate?negotiateVersion=1")]
    [InlineData("/api/core/hubs/location/negotiate?negotiateVersion=1")]
    [InlineData("/api/core/hubs/notifications/negotiate?negotiateVersion=1")]
    public async Task AuthenticatedNegotiateEndpoints_ReturnConnectionMetadataForEveryHub(string url)
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateAuthenticatedClient(Guid.NewGuid());

        var response = await client.PostAsJsonAsync(url, new { protocol = "json", version = 1 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await EndpointIntegrationTestHelpers.ReadJsonAsync(response);
        Assert.False(string.IsNullOrWhiteSpace(document.RootElement.GetProperty("connectionId").GetString()));
        Assert.True(document.RootElement.TryGetProperty("connectionToken", out var connectionToken));
        Assert.False(string.IsNullOrWhiteSpace(connectionToken.GetString()));
        Assert.Equal(1, document.RootElement.GetProperty("negotiateVersion").GetInt32());
        Assert.NotEmpty(document.RootElement.GetProperty("availableTransports").EnumerateArray());
    }
}
