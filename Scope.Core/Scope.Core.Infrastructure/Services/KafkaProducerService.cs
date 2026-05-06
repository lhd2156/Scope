using System.Text.Json;
using Scope.Core.Domain.Interfaces;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Scope.Core.Infrastructure.Services;

public sealed class KafkaProducerService : IKafkaProducerService, IDisposable
{
    private const int MessageTimeoutMs = 5000;
    private const int SocketTimeoutMs = 5000;

    private readonly string? bootstrapServers;
    private readonly ILogger<KafkaProducerService> logger;
    private readonly Lazy<IProducer<string, string>?> producer;

    public KafkaProducerService(IConfiguration configuration, ILogger<KafkaProducerService> logger)
    {
        this.logger = logger;
        bootstrapServers = configuration["KAFKA_BOOTSTRAP_SERVERS"];
        producer = new Lazy<IProducer<string, string>?>(BuildProducer, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public async Task PublishAsync(string topic, object payload, CancellationToken cancellationToken = default)
    {
        var activeProducer = producer.Value;
        if (activeProducer is null)
        {
            logger.LogDebug("Kafka bootstrap not configured; skipped topic {Topic}", topic);
            return;
        }

        var body = JsonSerializer.Serialize(payload);
        try
        {
            await activeProducer.ProduceAsync(topic, new Message<string, string> { Key = Guid.NewGuid().ToString(), Value = body }, cancellationToken);
            logger.LogDebug("Produced Kafka event to {Topic}", topic);
        }
        catch (ProduceException<string, string> ex)
        {
            logger.LogWarning(ex, "Failed to produce Kafka event to {Topic}", topic);
        }
        catch (KafkaException ex)
        {
            logger.LogWarning(ex, "Kafka transport failed for topic {Topic}", topic);
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Kafka publish timed out for topic {Topic}", topic);
        }
    }

    public void Dispose()
    {
        if (producer.IsValueCreated)
        {
            producer.Value?.Dispose();
        }
    }

    private IProducer<string, string>? BuildProducer()
    {
        if (string.IsNullOrWhiteSpace(bootstrapServers))
        {
            return null;
        }

        return new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = bootstrapServers,
            MessageTimeoutMs = MessageTimeoutMs,
            SocketTimeoutMs = SocketTimeoutMs,
        }).Build();
    }
}
