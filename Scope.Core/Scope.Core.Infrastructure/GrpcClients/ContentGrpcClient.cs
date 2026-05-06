using Scope.Proto.V1;
using Grpc.Net.Client;

namespace Scope.Core.Infrastructure.GrpcClients;

public class ContentGrpcClient : IDisposable
{
    private readonly GrpcChannel _channel;
    private readonly SpotService.SpotServiceClient _spotClient;

    public ContentGrpcClient(string address = "http://content:50051")
    {
        _channel = GrpcChannel.ForAddress(address);
        _spotClient = new SpotService.SpotServiceClient(_channel);
    }

    public async Task<Spot?> GetSpotAsync(string id, CancellationToken ct = default)
    {
        var request = new GetSpotRequest { Id = id };
        return await _spotClient.GetSpotAsync(request, cancellationToken: ct);
    }

    public async Task<ListSpotsResponse> ListSpotsAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var request = new ListSpotsRequest
        {
            Pagination = new Pagination { Page = page, PageSize = pageSize }
        };
        return await _spotClient.ListSpotsAsync(request, cancellationToken: ct);
    }

    public void Dispose() => _channel.Dispose();
}
