using MongoDB.Driver;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Api.Stories;

/// <summary>
/// Deletes expired stories and their media. Never throws out of the loop (an unhandled exception in a BackgroundService
/// would stop the host), same as the snap cleanup.
/// </summary>
public sealed class StoryCleanupService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<StoryCleanupService> _logger;

    public StoryCleanupService(IServiceScopeFactory scopes, ILogger<StoryCleanupService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var purged = await PurgeOnceAsync(stoppingToken);
                if (purged > 0) _logger.LogInformation("Story cleanup removed {Count} stor(ies)", purged);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Story cleanup pass failed; will retry");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    public async Task<int> PurgeOnceAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var stories = scope.ServiceProvider.GetRequiredService<IMongoDatabase>().GetCollection<StoryDocument>("stories");
        var storage = scope.ServiceProvider.GetRequiredService<ISnapStorage>();
        var now = DateTime.UtcNow;
        var expired = await stories.Find(s => s.ExpiresAtUtc <= now).Limit(500).ToListAsync(ct);
        foreach (var story in expired)
        {
            await storage.DeleteAsync(story.MediaKey, ct);
            await stories.DeleteOneAsync(s => s.Id == story.Id, ct);
        }
        return expired.Count;
    }
}
