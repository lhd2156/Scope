namespace Scope.Core.Domain.Interfaces;

public interface IKafkaProducerService
{
    Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default);
}
