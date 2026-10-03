using MongoDB.Bson;
using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Repositories;

public class MongoPlaceWatchRepository : IPlaceWatchRepository
{
    private readonly IMongoCollection<PlaceWatch> _watches;

    public MongoPlaceWatchRepository(IMongoDatabase db)
    {
        _watches = db.GetCollection<PlaceWatch>("place_watches");
        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        var keys = Builders<PlaceWatch>.IndexKeys;
        _watches.Indexes.CreateMany(new[]
        {
            new CreateIndexModel<PlaceWatch>(keys.Ascending(x => x.UserId).Ascending(x => x.PlaceId), new CreateIndexOptions { Unique = true, Name = "ux_place_watches_user_place" }),
            new CreateIndexModel<PlaceWatch>(keys.Ascending(x => x.PlaceId).Ascending(x => x.ExpiresAtUtc), new CreateIndexOptions { Name = "ix_place_watches_place" }),
            // Expired watches disappear on their own (12 h lifetime).
            new CreateIndexModel<PlaceWatch>(keys.Ascending(x => x.ExpiresAtUtc), new CreateIndexOptions { Name = "ttl_place_watches", ExpireAfter = TimeSpan.Zero }),
        });
    }

    public async Task<IReadOnlyList<PlaceWatch>> ListForUserAsync(Guid userId, DateTime nowUtc, CancellationToken ct) =>
        await _watches.Find(x => x.UserId == userId && x.ExpiresAtUtc > nowUtc).SortByDescending(x => x.CreatedAtUtc).ToListAsync(ct);

    public async Task<int> CountActiveAsync(Guid userId, DateTime nowUtc, CancellationToken ct) =>
        (int)await _watches.CountDocumentsAsync(x => x.UserId == userId && x.ExpiresAtUtc > nowUtc, cancellationToken: ct);

    public async Task<PlaceWatch> UpsertAsync(PlaceWatch watch, CancellationToken ct)
    {
        var filter = Builders<PlaceWatch>.Filter.Eq(x => x.UserId, watch.UserId) & Builders<PlaceWatch>.Filter.Eq(x => x.PlaceId, watch.PlaceId);
        var update = Builders<PlaceWatch>.Update
            .SetOnInsert(x => x.UserId, watch.UserId)
            .SetOnInsert(x => x.PlaceId, watch.PlaceId)
            .Set(x => x.PlaceName, watch.PlaceName)
            .Set(x => x.Condition, watch.Condition)
            .Set(x => x.CreatedAtUtc, watch.CreatedAtUtc)
            .Set(x => x.ExpiresAtUtc, watch.ExpiresAtUtc);
        var options = new FindOneAndUpdateOptions<PlaceWatch> { IsUpsert = true, ReturnDocument = ReturnDocument.After };
        try
        {
            return await _watches.FindOneAndUpdateAsync(filter, update, options, ct);
        }
        catch (MongoCommandException ex) when (ex.Code == 11000)
        {
            // Two requests raced to insert the same person+place; the loser updates the winner's row.
            return await _watches.FindOneAndUpdateAsync(filter, update, new FindOneAndUpdateOptions<PlaceWatch> { ReturnDocument = ReturnDocument.After }, ct);
        }
    }

    public async Task<bool> RemoveAsync(Guid userId, Guid placeId, CancellationToken ct) =>
        (await _watches.DeleteOneAsync(x => x.UserId == userId && x.PlaceId == placeId, ct)).DeletedCount > 0;

    public async Task<IReadOnlyList<PlaceWatch>> ListForPlaceAsync(Guid placeId, DateTime nowUtc, CancellationToken ct) =>
        await _watches.Find(x => x.PlaceId == placeId && x.ExpiresAtUtc > nowUtc).Limit(5000).ToListAsync(ct);

    public async Task<bool> TryConsumeAsync(string watchId, CancellationToken ct)
    {
        if (!ObjectId.TryParse(watchId, out _)) return false;
        return (await _watches.DeleteOneAsync(x => x.Id == watchId, ct)).DeletedCount == 1;
    }

    public Task DeleteForUserAsync(Guid userId, CancellationToken ct) => _watches.DeleteManyAsync(x => x.UserId == userId, ct);
}
