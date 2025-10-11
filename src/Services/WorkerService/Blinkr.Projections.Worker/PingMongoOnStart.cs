using MongoDB.Bson;
using MongoDB.Driver;

public class PingMongoOnStart : IHostedService
{
    private readonly IMongoDatabase _db;
    private readonly ILogger<PingMongoOnStart> _log;

    public PingMongoOnStart(IMongoDatabase db, ILogger<PingMongoOnStart> log)
    { _db = db; _log = log; }

    public async Task StartAsync(CancellationToken ct)
    {
        try
        {
            // Ping
            var command = new BsonDocument("ping", 1);
            await _db.RunCommandAsync<BsonDocument>(command, cancellationToken: ct);
            _log.LogInformation("Mongo ping OK");

            // Yazma testi
            var col = _db.GetCollection<BsonDocument>("__health");
            await col.ReplaceOneAsync(
                Builders<BsonDocument>.Filter.Eq("_id", "startup"),
                new BsonDocument { { "_id", "startup" }, { "ts", DateTime.UtcNow } },
                new ReplaceOptions { IsUpsert = true },
                ct);

            _log.LogInformation("Mongo write OK");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Mongo connectivity/write test FAILED");
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
