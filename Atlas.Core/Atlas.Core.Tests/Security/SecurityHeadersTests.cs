using System.Net;
using System.Net.Http.Json;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Atlas.Core.Tests.Security;

public sealed class SecurityHeadersTests(ApiTestWebApplicationFactory factory) : IClassFixture<ApiTestWebApplicationFactory>
{
    private readonly HttpClient client = factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false
    });

    [Fact]
    public async Task PublicApiResponses_IncludeSecurityHeaders()
    {
        var response = await client.GetAsync("/api/core/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertSecurityHeaders(response);
    }

    [Fact]
    public async Task UnauthorizedProtectedApiResponses_IncludeSecurityHeaders()
    {
        var response = await client.GetAsync("/api/core/users/11111111-1111-1111-1111-111111111111");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        AssertSecurityHeaders(response);
    }

    [Fact]
    public async Task UnauthorizedHubNegotiateResponses_IncludeSecurityHeaders()
    {
        var response = await client.PostAsync(
            "/api/core/hubs/notifications/negotiate?negotiateVersion=1",
            JsonContent.Create(new { protocol = "json", version = 1 }));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        AssertSecurityHeaders(response);
    }

    private static void AssertSecurityHeaders(HttpResponseMessage response)
    {
        Assert.Equal(CoreSecurityHeaders.ContentSecurityPolicyValue, response.Headers.GetValues(CoreSecurityHeaders.ContentSecurityPolicyName).Single());
        Assert.Equal(CoreSecurityHeaders.XssProtectionValue, response.Headers.GetValues(CoreSecurityHeaders.XssProtectionName).Single());
    }
}
