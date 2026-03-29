using Atlas.Core.Domain.Constants;

namespace Atlas.Core.Tests.Infrastructure;

public sealed class KafkaConfiguredApiTestWebApplicationFactory : ApiTestWebApplicationFactory
{
    protected override IReadOnlyDictionary<string, string?> AdditionalConfiguration
        => new Dictionary<string, string?>(base.AdditionalConfiguration)
        {
            [CoreConfigurationKeys.KafkaBootstrapServers] = "localhost:9092"
        };
}
