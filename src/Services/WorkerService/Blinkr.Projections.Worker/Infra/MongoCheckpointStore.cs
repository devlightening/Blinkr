using EventStore.Client;
using MongoDB.Driver;

namespace Blinkr.Projections.Worker.Infra;

public class MongoCheckpointStore : ICheckpointStore
{
    private readonly IMongoCollection<CheckpointDocument> _collection;
    
    public MongoCheckpointStore(IMongoDatabase db)
    {
        _collection = db.GetCollection<CheckpointDocument>("__checkpoints");
    }

    public async Task<Position?> GetAsync(string name, CancellationToken ct)
    {
        var doc = await _collection.Find(x => x.Id == name).FirstOrDefaultAsync(ct);
        return doc?.Position;
    }

    public async Task SaveAsync(string name, Position pos, CancellationToken ct)
    {
        await _collection.ReplaceOneAsync(
            x => x.Id == name,
            new CheckpointDocument { Id = name, Position = pos },
            new ReplaceOptions { IsUpsert = true },
            ct);
    }
}

public class CheckpointDocument
{
    public string Id { get; set; } = null!;
    public Position Position { get; set; }
}
