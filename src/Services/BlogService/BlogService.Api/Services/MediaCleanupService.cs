using BlogService.Application.Services;
using Microsoft.Extensions.Options;

namespace BlogService.Api.Services;

public sealed class MediaCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MediaOptions _options;
    private readonly ILogger<MediaCleanupService> _logger;

    public MediaCleanupService(IServiceScopeFactory scopeFactory, IOptions<MediaOptions> options, ILogger<MediaCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, _options.OrphanCleanupIntervalMinutes)));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // This is housekeeping. An unreachable database (a Docker restart, a Mongo blip) must never
            // escape: with BackgroundServiceExceptionBehavior=StopHost an unhandled exception here shuts
            // the whole BlogService down, and the map and every post endpoint answer 502. The next tick retries.
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<IMediaAttachmentService>();
                var count = await service.MarkExpiredOrphansAsync(TimeSpan.FromHours(_options.OrphanCleanupHours), stoppingToken);
                if (count > 0) _logger.LogInformation("Marked {Count} orphan media uploads as expired", count);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Orphan media cleanup failed; it will be retried on the next tick");
            }
        }
    }
}
