using EventStore.Client;

namespace Blinkr.Projections.Worker.Infra;

public interface ICheckpointStore
{
    Task<Position?> GetAsync(string name, CancellationToken ct);
    Task SaveAsync(string name, Position pos, CancellationToken ct);
}
