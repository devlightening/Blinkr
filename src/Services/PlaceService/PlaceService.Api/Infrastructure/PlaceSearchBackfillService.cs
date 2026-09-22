using PlaceService.Api.Infrastructure;

namespace PlaceService.Api.Infrastructure;

/// <summary>
/// Fills the search tokens of places that do not have them yet (the catalogue importer and older documents write
/// places without). It runs in small batches, sleeps when there is nothing to do, and never throws out of the loop:
/// an unhandled exception in a BackgroundService would stop the whole host.
/// </summary>
public sealed class PlaceSearchBackfillService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PlaceSearchBackfillService> _logger;

    public PlaceSearchBackfillService(IServiceScopeFactory scopes, ILogger<PlaceSearchBackfillService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var total = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = TimeSpan.FromMinutes(5);
            try
            {
                using var scope = _scopes.CreateScope();
                var repository = scope.ServiceProvider.GetRequiredService<IPlaceRepository>();
                var updated = await repository.BackfillSearchTokensAsync(2000, stoppingToken);
                total += updated;
                if (updated > 0)
                {
                    delay = TimeSpan.FromMilliseconds(150);
                    if (total % 20000 < updated) _logger.LogInformation("Place search tokens backfilled: {Total}", total);
                }
                else if (total > 0)
                {
                    _logger.LogInformation("Place search tokens are complete ({Total} places filled this run)", total);
                    total = 0;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Place search token backfill failed; retrying later");
                delay = TimeSpan.FromMinutes(1);
            }

            try { await Task.Delay(delay, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
