using System.Net;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Tests.Infrastructure;
using Xunit;

namespace Atlas.Core.Tests.Security;

public sealed class CorsPolicyTests(ApiTestWebApplicationFactory factory) : IClassFixture<ApiTestWebApplicationFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task PreflightRequest_AllowsConfiguredFrontendOriginOutsideDevelopment()
    {
        using var request = BuildPreflightRequest("https://atlas.example.com", "POST");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("https://atlas.example.com", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("true", response.Headers.GetValues("Access-Control-Allow-Credentials").Single());
        Assert.Contains("Authorization", response.Headers.GetValues("Access-Control-Allow-Headers").Single(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Content-Type", response.Headers.GetValues("Access-Control-Allow-Headers").Single(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains("POST", response.Headers.GetValues("Access-Control-Allow-Methods").Single(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PreflightRequest_RejectsUnexpectedOriginOutsideDevelopment()
    {
        using var request = BuildPreflightRequest("http://localhost:5173", "GET");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.False(response.Headers.Contains("Access-Control-Allow-Credentials"));
    }

    private static HttpRequestMessage BuildPreflightRequest(string origin, string requestedMethod)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/api/core/health");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", requestedMethod);
        request.Headers.Add("Access-Control-Request-Headers", "Authorization, Content-Type");
        return request;
    }
}

public sealed class DevelopmentCorsPolicyTests(DevelopmentApiTestWebApplicationFactory factory) : IClassFixture<DevelopmentApiTestWebApplicationFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task PreflightRequest_AllowsLocalhostOriginInDevelopment()
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/core/health");
        request.Headers.Add("Origin", CoreDefaults.DevelopmentFrontendOrigin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "Authorization, Content-Type");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(CoreDefaults.DevelopmentFrontendOrigin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("true", response.Headers.GetValues("Access-Control-Allow-Credentials").Single());
    }
}
