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
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IMediaAttachmentService>();
            var count = await service.MarkExpiredOrphansAsync(TimeSpan.FromHours(_options.OrphanCleanupHours), stoppingToken);
            if (count > 0) _logger.LogInformation("Marked {Count} orphan media uploads as expired", count);
        }
    }
}

