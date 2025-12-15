using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Repositories;

public class MongoDeviceTokenRepository : IDeviceTokenRepository
{
    private readonly IMongoCollection<DeviceToken> _tokens;

    public MongoDeviceTokenRepository(IMongoDatabase db)
    {
        _tokens = db.GetCollection<DeviceToken>("device_tokens");
        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        _tokens.Indexes.CreateOne(
            new CreateIndexModel<DeviceToken>(
                Builders<DeviceToken>.IndexKeys.Ascending(x => x.UserId).Ascending(x => x.Token),
                new CreateIndexOptions { Unique = true }));
    }

    public async Task UpsertAsync(DeviceToken token, CancellationToken ct)
    {
        var filter = Builders<DeviceToken>.Filter.Eq(x => x.UserId, token.UserId) &
                     Builders<DeviceToken>.Filter.Eq(x => x.Token, token.Token);
        await _tokens.ReplaceOneAsync(filter, token, new ReplaceOptions { IsUpsert = true }, ct);
    }

    public async Task<IReadOnlyList<DeviceToken>> GetByUserIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var arr = userIds.ToArray();
        var list = await _tokens.Find(x => arr.Contains(x.UserId)).ToListAsync(ct);
        return list;
    }
}
