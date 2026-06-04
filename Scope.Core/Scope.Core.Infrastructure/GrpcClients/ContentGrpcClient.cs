using Scope.Proto.V1;
using Grpc.Core;
using Grpc.Net.Client;

namespace Scope.Core.Infrastructure.GrpcClients;

public class ContentGrpcClient : IDisposable
{
    private readonly GrpcChannel _channel;
    private readonly SpotService.SpotServiceClient _spotClient;
    private readonly Metadata? _callMetadata;

    public ContentGrpcClient(string address = "http://content:50051", string? internalToken = null)
    {
        _channel = GrpcChannel.ForAddress(address);
        _spotClient = new SpotService.SpotServiceClient(_channel);
        _callMetadata = string.IsNullOrWhiteSpace(internalToken)
            ? null
            : new Metadata { { "x-scope-internal-token", internalToken.Trim() } };
    }

    public async Task<Spot?> GetSpotAsync(string id, CancellationToken ct = default)
    {
        var request = new GetSpotRequest { Id = id };
        return await _spotClient.GetSpotAsync(request, headers: _callMetadata, cancellationToken: ct);
    }

    public async Task<ListSpotsResponse> ListSpotsAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var request = new ListSpotsRequest
        {
            Pagination = new Pagination { Page = page, PageSize = pageSize }
        };
        return await _spotClient.ListSpotsAsync(request, headers: _callMetadata, cancellationToken: ct);
    }

    public void Dispose() => _channel.Dispose();
}
