using EventStore.Client;

namespace BlogService.Infrastructure;

public interface ICheckpointStore
{
    Task<Position?> GetAsync(string key, CancellationToken ct = default);
    Task StoreAsync(string key, Position position, CancellationToken ct = default);
}

