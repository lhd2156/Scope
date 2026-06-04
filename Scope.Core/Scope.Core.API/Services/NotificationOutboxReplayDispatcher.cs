using Scope.Core.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Scope.Core.API.Services;

public sealed class NotificationOutboxReplayDispatcher(
    IServiceScopeFactory scopeFactory,
    ILogger<NotificationOutboxReplayDispatcher> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Notification outbox replay batch failed");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    private async Task ProcessPendingAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<CoreDbContext>();
        var now = DateTimeOffset.UtcNow;
        var records = await dbContext.NotificationOutbox
            .Where(x => x.Status == "pending" && x.AvailableAt <= now)
            .OrderBy(x => x.AvailableAt)
            .Take(20)
            .ToListAsync(cancellationToken);

        foreach (var record in records)
        {
            try
            {
                await NotificationEventConsumerService.ProcessOutboxRecordAsync(scope.ServiceProvider, record, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to replay notification outbox record {OutboxId}", record.Id);
            }
        }
    }
}
