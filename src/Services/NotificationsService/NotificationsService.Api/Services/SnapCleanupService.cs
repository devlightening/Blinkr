using NotificationsService.Application.Snaps;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Api.Services;

/// <summary>
/// Deletes snap files that nobody may look at any more: opened snaps once their viewing window is long over and
/// unopened snaps past their expiry. It never throws out of the loop - an unhandled exception in a
/// BackgroundService would stop the whole host (BackgroundServiceExceptionBehavior=StopHost).
/// </summary>
public sealed class SnapCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly SnapSettings _settings;
    private readonly ILogger<SnapCleanupService> _logger;

    public SnapCleanupService(IServiceScopeFactory scopes, SnapSettings settings, ILogger<SnapCleanupService> logger)
    {
        _scopes = scopes;
        _settings = settings;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromSeconds(Math.Max(5, _settings.CleanupIntervalSeconds));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var purged = await PurgeOnceAsync(stoppingToken);
                if (purged > 0) _logger.LogInformation("Snap cleanup removed {Count} file(s)", purged);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Snap cleanup pass failed; will retry in {Seconds}s", interval.TotalSeconds);
            }

            try { await Task.Delay(interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    public async Task<int> PurgeOnceAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var messages = scope.ServiceProvider.GetRequiredService<IChatMessageRepository>();
        var storage = scope.ServiceProvider.GetRequiredService<ISnapStorage>();
        var now = DateTime.UtcNow;
        var openedBefore = now - TimeSpan.FromSeconds(Math.Max(_settings.UntimedViewSeconds, 10 + _settings.ViewGraceSeconds));
        var purged = 0;
        foreach (var message in await messages.ListPurgeableSnapsAsync(openedBefore, now, 200, ct))
        {
            if (message.Snap?.ObjectKey is null || message.Id is null) continue;
            await storage.DeleteAsync(message.Snap.ObjectKey, ct);
            await messages.MarkSnapPurgedAsync(message.Id, ct);
            purged++;
        }
        return purged;
    }
}
