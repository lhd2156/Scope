using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Atlas.Core.Tests.Security;

public sealed class JwtAuthorizationTests(ApiTestWebApplicationFactory factory) : IClassFixture<ApiTestWebApplicationFactory>
{
    private readonly HttpClient client = factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false
    });

    [Theory]
    [InlineData("GET", "/api/core/users/11111111-1111-1111-1111-111111111111")]
    [InlineData("PUT", "/api/core/users/11111111-1111-1111-1111-111111111111")]
    [InlineData("DELETE", "/api/core/users/11111111-1111-1111-1111-111111111111")]
    [InlineData("GET", "/api/core/users/search?q=louis")]
    [InlineData("PUT", "/api/core/users/11111111-1111-1111-1111-111111111111/avatar")]
    [InlineData("GET", "/api/core/users/11111111-1111-1111-1111-111111111111/stats")]
    [InlineData("POST", "/api/core/friends/request/22222222-2222-2222-2222-222222222222")]
    [InlineData("PUT", "/api/core/friends/33333333-3333-3333-3333-333333333333/accept")]
    [InlineData("PUT", "/api/core/friends/33333333-3333-3333-3333-333333333333/decline")]
    [InlineData("DELETE", "/api/core/friends/33333333-3333-3333-3333-333333333333")]
    [InlineData("GET", "/api/core/friends")]
    [InlineData("GET", "/api/core/friends/pending")]
    [InlineData("POST", "/api/core/friends/22222222-2222-2222-2222-222222222222/block")]
    [InlineData("GET", "/api/core/notifications")]
    [InlineData("PUT", "/api/core/notifications/44444444-4444-4444-4444-444444444444/read")]
    [InlineData("PUT", "/api/core/notifications/read-all")]
    [InlineData("DELETE", "/api/core/notifications/44444444-4444-4444-4444-444444444444")]
    [InlineData("GET", "/api/core/notifications/unread-count")]
    [InlineData("POST", "/api/core/live/start/55555555-5555-5555-5555-555555555555")]
    [InlineData("PUT", "/api/core/live/ping")]
    [InlineData("POST", "/api/core/live/stop")]
    [InlineData("GET", "/api/core/live/trip/55555555-5555-5555-5555-555555555555")]
    public async Task ProtectedRestEndpoints_RejectRequestsWithoutJwt(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url)
        {
            Content = BuildRequestContent(method, url)
        };

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/core/hubs/trips/negotiate?negotiateVersion=1")]
    [InlineData("/api/core/hubs/location/negotiate?negotiateVersion=1")]
    [InlineData("/api/core/hubs/notifications/negotiate?negotiateVersion=1")]
    public async Task ProtectedSignalRHubs_RejectNegotiateRequestsWithoutJwt(string url)
    {
        var response = await client.PostAsync(url, JsonContent.Create(new { protocol = "json", version = 1 }));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("POST", "/api/core/auth/login")]
    [InlineData("POST", "/api/core/auth/register")]
    [InlineData("POST", "/api/core/auth/refresh")]
    [InlineData("POST", "/api/core/auth/logout")]
    [InlineData("POST", "/api/core/auth/forgot-password")]
    [InlineData("POST", "/api/core/auth/reset-password")]
    [InlineData("POST", "/api/core/auth/oauth/cognito")]
    [InlineData("GET", "/api/core/health")]
    public async Task PublicEndpoints_DoNotRequireJwt(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url)
        {
            Content = method == "POST" ? JsonContent.Create(new { }) : null
        };

        var response = await client.SendAsync(request);

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoints_AcceptWellFormedBearerHeaderForAuthenticationPipeline()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/core/users/11111111-1111-1111-1111-111111111111");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-valid-token");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static HttpContent? BuildRequestContent(string method, string url)
    {
        if (method is not "PUT" and not "POST")
        {
            return null;
        }

        if (url.Contains("/avatar", StringComparison.OrdinalIgnoreCase))
        {
            var multipart = new MultipartFormDataContent();
            var fileContent = new StreamContent(new MemoryStream([1, 2, 3, 4]));
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            multipart.Add(fileContent, "file", "avatar.png");
            return multipart;
        }

        return JsonContent.Create(new { tripId = Guid.NewGuid(), latitude = 32.7555, longitude = -97.3308, refreshToken = "refresh-token" });
    }
}
