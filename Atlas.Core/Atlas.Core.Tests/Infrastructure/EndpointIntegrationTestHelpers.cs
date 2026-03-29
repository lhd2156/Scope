using System.Collections;
using System.Reflection;
using System.Text.Json;
using Atlas.Core.Domain.Models;
using Atlas.Core.Infrastructure.Services;
using Xunit;

namespace Atlas.Core.Tests.Infrastructure;

internal static class EndpointIntegrationTestHelpers
{
    public static void AssertPropertyNames(JsonElement element, IReadOnlyList<string> expectedNames)
    {
        var actualNames = element.EnumerateObject().Select(property => property.Name).ToArray();
        Assert.Equal(expectedNames, actualNames);
    }

    public static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
        => JsonDocument.Parse(await response.Content.ReadAsStringAsync());

    public static async Task AssertErrorAsync(HttpResponseMessage response, int expectedStatusCode, string expectedCode)
    {
        Assert.Equal(expectedStatusCode, (int)response.StatusCode);
        using var document = await ReadJsonAsync(response);
        var error = document.RootElement.GetProperty("error");
        Assert.Equal(expectedCode, error.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("message").GetString()));
        Assert.True(error.TryGetProperty("details", out var details));
        Assert.Equal(JsonValueKind.Array, details.ValueKind);
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("traceId").GetString()));
    }

    public static MultipartFormDataContent CreateAvatarContent(byte[] bytes, string fileName = "avatar.png", string contentType = "image/png")
    {
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        content.Add(fileContent, "file", fileName);
        return content;
    }

    public static void StorePasswordResetTicket(string token, Guid userId, DateTimeOffset? expiresAt = null)
    {
        var tickets = GetPasswordResetTickets();
        var ticketType = typeof(AuthService).GetNestedType("PasswordResetTicket", BindingFlags.NonPublic)!;
        var ticket = Activator.CreateInstance(ticketType, userId, expiresAt ?? DateTimeOffset.UtcNow.AddHours(1))!;
        tickets.GetType().GetMethod("TryAdd")!.Invoke(tickets, [token, ticket]);
    }

    public static void ClearPasswordResetTickets()
        => GetPasswordResetTickets().GetType().GetMethod("Clear")!.Invoke(GetPasswordResetTickets(), []);

    public static async Task<ApiResponse<JsonElement>> ReadApiResponseAsync(HttpResponseMessage response)
    {
        var document = await ReadJsonAsync(response);
        var root = document.RootElement.Clone();
        document.Dispose();
        var data = root.GetProperty("data");
        var meta = root.TryGetProperty("meta", out var metaElement) ? metaElement.Clone() : default;
        return new ApiResponse<JsonElement>(data.Clone(), meta.ValueKind == JsonValueKind.Undefined ? null : (object)meta.Clone());
    }

    private static object GetPasswordResetTickets()
        => typeof(AuthService)
            .GetField("PasswordResetTickets", BindingFlags.NonPublic | BindingFlags.Static)!
            .GetValue(null)!;
}
