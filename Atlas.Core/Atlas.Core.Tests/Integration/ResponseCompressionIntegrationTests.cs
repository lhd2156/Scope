using System.IO.Compression;
using System.Net;
using System.Text;
using Atlas.Core.Domain.Constants;
using Atlas.Core.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Atlas.Core.Tests.Integration;

public sealed class ResponseCompressionIntegrationTests
{
    [Theory]
    [InlineData("gzip")]
    [InlineData("br")]
    public async Task HealthEndpoint_CompressesResponsesWhenEncodingIsRequested(string encoding)
    {
        using var factory = new ApiTestWebApplicationFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/core/health");
        request.Headers.AcceptEncoding.ParseAdd(encoding);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(encoding, response.Content.Headers.ContentEncoding, StringComparer.OrdinalIgnoreCase);
        Assert.Contains(CoreCaching.VaryAcceptEncodingValue, response.Headers.Vary, StringComparer.OrdinalIgnoreCase);

        var bytes = await response.Content.ReadAsByteArrayAsync();
        var body = encoding.Equals("gzip", StringComparison.OrdinalIgnoreCase)
            ? DecompressGzip(bytes)
            : DecompressBrotli(bytes);
        Assert.Contains("status", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AuthenticatedReadEndpoints_CompressAndPreserveAuthorizationPlusAcceptEncodingVaryHeaders()
    {
        using var factory = new ApiTestWebApplicationFactory();
        var user = TestSupport.CreateUser();
        await factory.SeedAsync(db => db.Users.Add(user));
        using var client = factory.CreateAuthenticatedClient(user.Id, user.Email, user.DisplayName, user.Role);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/core/users/{user.Id}");
        request.Headers.Authorization = client.DefaultRequestHeaders.Authorization;
        request.Headers.AcceptEncoding.ParseAdd("gzip");

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("gzip", response.Content.Headers.ContentEncoding, StringComparer.OrdinalIgnoreCase);
        Assert.Contains(CoreCaching.VaryAcceptEncodingValue, response.Headers.Vary, StringComparer.OrdinalIgnoreCase);
        Assert.Contains(CoreCaching.VaryAuthorizationValue, response.Headers.Vary, StringComparer.OrdinalIgnoreCase);
        Assert.True(response.Headers.Contains(CoreCaching.EntityTagHeaderName));
    }

    private static string DecompressGzip(byte[] bytes)
    {
        using var input = new MemoryStream(bytes);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var reader = new StreamReader(gzip, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static string DecompressBrotli(byte[] bytes)
    {
        using var input = new MemoryStream(bytes);
        using var brotli = new BrotliStream(input, CompressionMode.Decompress);
        using var reader = new StreamReader(brotli, Encoding.UTF8);
        return reader.ReadToEnd();
    }
}
