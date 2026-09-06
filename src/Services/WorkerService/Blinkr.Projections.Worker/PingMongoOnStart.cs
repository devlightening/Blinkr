using MongoDB.Bson;
using MongoDB.Driver;

public class PingMongoOnStart : IHostedService
{
    private readonly IMongoDatabase _db;
    private readonly Blinkr.Projections.Worker.MongoIndexManager _indexManager;
    private readonly ILogger<PingMongoOnStart> _log;

    public PingMongoOnStart(IMongoDatabase db, Blinkr.Projections.Worker.MongoIndexManager indexManager, ILogger<PingMongoOnStart> log)
    { _db = db; _indexManager = indexManager; _log = log; }

    public async Task StartAsync(CancellationToken ct)
    {
        try
        {
            var command = new BsonDocument("ping", 1);
            await _db.RunCommandAsync<BsonDocument>(command, cancellationToken: ct);

            var col = _db.GetCollection<BsonDocument>("__health");
            await col.ReplaceOneAsync(
                Builders<BsonDocument>.Filter.Eq("_id", "startup"),
                new BsonDocument { { "_id", "startup" }, { "ts", DateTime.UtcNow } },
                new ReplaceOptions { IsUpsert = true },
                ct);

            _log.LogInformation("✅ Mongo connectivity check passed (ping + write)");
            await _indexManager.CreateIndexesAsync();
            _log.LogInformation("✅ Mongo indexes ensured");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "❌ Mongo connectivity/write test FAILED");
        }
    }


    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
