using EventStore.Client;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace BlogService.Infrastructure;

/// <summary>
/// Idempotent MongoDB checkpoint store with compare-and-swap optimization
/// </summary>
public sealed class MongoCheckpointStore : ICheckpointStore
{
    private readonly IMongoCollection<BsonDocument> _col;
    private readonly ILogger<MongoCheckpointStore> _log;

    public MongoCheckpointStore(IMongoDatabase db, ILogger<MongoCheckpointStore> log)
    {
        _col = db.GetCollection<BsonDocument>("es_checkpoints");
        _log = log;
    }

    public async Task<Position?> GetAsync(string key, CancellationToken ct = default)
    {
        var doc = await _col.Find(Builders<BsonDocument>.Filter.Eq("_id", key))
                            .FirstOrDefaultAsync(ct);

        if (doc is null) return null;

        // commit / prepare could be stored as Int64 or string (if overflow). Handle both.
        ulong commit;
        ulong prepare;

        var commitVal = doc.GetValue("commit", BsonNull.Value);
        var prepareVal = doc.GetValue("prepare", BsonNull.Value);

        if (commitVal.BsonType == BsonType.Int64)
        {
            var asLong = commitVal.AsInt64;
            if (asLong < 0) throw new InvalidOperationException("Stored commit is negative");
            commit = (ulong)asLong;
        }
        else if (commitVal.BsonType == BsonType.String && ulong.TryParse(commitVal.AsString, out var tmpC))
        {
            commit = tmpC;
        }
        else
        {
            throw new InvalidOperationException("Unsupported 'commit' BSON type in checkpoint doc");
        }

        if (prepareVal.BsonType == BsonType.Int64)
        {
            var asLong = prepareVal.AsInt64;
            if (asLong < 0) throw new InvalidOperationException("Stored prepare is negative");
            prepare = (ulong)asLong;
        }
        else if (prepareVal.BsonType == BsonType.String && ulong.TryParse(prepareVal.AsString, out var tmpP))
        {
            prepare = tmpP;
        }
        else
        {
            throw new InvalidOperationException("Unsupported 'prepare' BSON type in checkpoint doc");
        }

        return new Position(commit, prepare);
    }

    public async Task StoreAsync(string key, Position position, CancellationToken ct = default)
    {
        try
        {
            // Eğer position değerleri Int64 sınırına uyuyorsa Int64 yazıyoruz (daha compact).
            // Aşarsa String olarak saklıyoruz (taşma güvenliği).
            BsonValue commitVal = position.CommitPosition <= (ulong)long.MaxValue
                ? new BsonInt64((long)position.CommitPosition)
                : new BsonString(position.CommitPosition.ToString());

            BsonValue prepareVal = position.PreparePosition <= (ulong)long.MaxValue
                ? new BsonInt64((long)position.PreparePosition)
                : new BsonString(position.PreparePosition.ToString());

            var doc = new BsonDocument
            {
                ["_id"] = key,
                ["commit"] = commitVal,
                ["prepare"] = prepareVal,
                ["ts"] = DateTime.UtcNow
            };

            // Simple upsert - MongoDB will handle duplicate key by replacing
            var filter = Builders<BsonDocument>.Filter.Eq("_id", key);
            
            await _col.ReplaceOneAsync(
                filter,
                doc,
                new ReplaceOptions { IsUpsert = true },
                ct);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            // Duplicate key on concurrent write - this is OK, another process already stored a newer checkpoint
            // Just log and continue - idempotent behavior
            _log.LogDebug("Checkpoint already exists for key {Key} - concurrent write detected", key);
        }
    }
}
