using System.Threading.Channels;

namespace PlaceService.Api.Infrastructure;

public interface IPlaceDiscoveryRefreshQueue
{
    void Enqueue(double minLat, double minLon, double maxLat, double maxLon, int limit);
}

public sealed class PlaceDiscoveryRefreshQueue : BackgroundService, IPlaceDiscoveryRefreshQueue
{
    private readonly Channel<RefreshRequest> _queue = Channel.CreateBounded<RefreshRequest>(new BoundedChannelOptions(64)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true,
        SingleWriter = false
    });
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PlaceDiscoveryRefreshQueue> _logger;
    private readonly HashSet<string> _queuedKeys = new();
    private readonly object _gate = new();

    public PlaceDiscoveryRefreshQueue(IServiceScopeFactory scopeFactory, ILogger<PlaceDiscoveryRefreshQueue> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public void Enqueue(double minLat, double minLon, double maxLat, double maxLon, int limit)
    {
        using var scope = _scopeFactory.CreateScope();
        var discovery = scope.ServiceProvider.GetRequiredService<IPlaceDiscoveryService>();
        var key = discovery.CreateCoverageKey(minLat, minLon, maxLat, maxLon);

        lock (_gate)
        {
            if (!_queuedKeys.Add(key)) return;
        }

        if (!_queue.Writer.TryWrite(new RefreshRequest(key, minLat, minLon, maxLat, maxLon, limit)))
        {
            lock (_gate) _queuedKeys.Remove(key);
            _logger.LogWarning("[Blinkr PlaceDiscovery] source=LOCAL_PLUS_REFRESH status=queue_full coverage={Coverage}", PlaceDiscoveryService.CoverageLogId(key));
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var request in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var discovery = scope.ServiceProvider.GetRequiredService<IPlaceDiscoveryService>();
                await discovery.RefreshBoundsCoverageAsync(request.MinLat, request.MinLon, request.MaxLat, request.MaxLon, request.Limit, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Blinkr PlaceDiscovery] source=LOCAL_PLUS_REFRESH status=failed coverage={Coverage}", PlaceDiscoveryService.CoverageLogId(request.Key));
            }
            finally
            {
                lock (_gate) _queuedKeys.Remove(request.Key);
            }
        }
    }

    private sealed record RefreshRequest(string Key, double MinLat, double MinLon, double MaxLat, double MaxLon, int Limit);
}
