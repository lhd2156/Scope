using Atlas.Core.Domain.Constants;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;

namespace Atlas.Core.Tests.Infrastructure;

internal static class SignalRTestConnectionFactory
{
    public static HubConnection CreateAuthenticatedHubConnection(
        ApiTestWebApplicationFactory factory,
        string hubPath,
        Guid userId,
        string email = "louis@example.com",
        string displayName = "Louis Do",
        string role = CoreRoles.User)
    {
        var baseAddress = factory.Server.BaseAddress ?? new Uri("http://localhost");

        return new HubConnectionBuilder()
            .WithUrl(new Uri(baseAddress, hubPath), options =>
            {
                options.AccessTokenProvider = () => Task.FromResult<string?>(factory.CreateAccessToken(userId, email, displayName, role));
                options.HttpMessageHandlerFactory = _ => factory.Server.CreateHandler();
                options.Transports = HttpTransportType.LongPolling;
            })
            .Build();
    }
}
