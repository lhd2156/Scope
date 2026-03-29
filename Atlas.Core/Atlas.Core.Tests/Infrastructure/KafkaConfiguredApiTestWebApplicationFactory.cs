using Atlas.Core.Domain.Constants;
using Atlas.Core.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Atlas.Core.Tests.Infrastructure;

public sealed class KafkaConfiguredApiTestWebApplicationFactory : ApiTestWebApplicationFactory
{
    protected override IReadOnlyDictionary<string, string?> AdditionalConfiguration
        => new Dictionary<string, string?>(base.AdditionalConfiguration)
        {
            [CoreConfigurationKeys.KafkaBootstrapServers] = "localhost:9092"
        };

    protected override void ConfigureTestServices(IServiceCollection services)
    {
        services.RemoveAll<IKafkaHealthCheckService>();
        services.AddScoped<IKafkaHealthCheckService>(_ => new TestKafkaHealthCheckService(true));
    }

    private sealed class TestKafkaHealthCheckService(bool healthy) : IKafkaHealthCheckService
    {
        public Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(healthy);
    }
}
