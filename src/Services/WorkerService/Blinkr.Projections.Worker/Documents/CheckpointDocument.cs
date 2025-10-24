using EventStore.ClientAPI;

namespace Blinkr.Projections.Worker.Infra;

public class CheckpointDocument
{
    public string Id { get; set; } = null!;
    public Position Position { get; set; }
}
