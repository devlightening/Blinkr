using MongoDB.Bson;
using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Repositories;

public class MongoNotificationRepository : INotificationRepository, IDeviceTokenRepository
{
    private readonly IMongoCollection<Notification> _notifs;
    private readonly IMongoCollection<DeviceToken> _tokens;
    private readonly IMongoDatabase _db;

    public MongoNotificationRepository(IMongoDatabase db)
    {
        _db = db;
        _notifs = db.GetCollection<Notification>("notifications");
        _tokens = db.GetCollection<DeviceToken>("device_tokens");

        // Ensure indexes
        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        // Notifications index
        _notifs.Indexes.CreateOne(
            new CreateIndexModel<Notification>(
                Builders<Notification>.IndexKeys.Descending(x => x.UserId).Descending(x => x.CreatedAtUtc)));

        // Device tokens index
        _tokens.Indexes.CreateOne(
            new CreateIndexModel<DeviceToken>(
                Builders<DeviceToken>.IndexKeys.Ascending(x => x.UserId).Ascending(x => x.Token),
                new CreateIndexOptions { Unique = true }));

        // User locations 2dsphere index for proximity queries
        var userLocations = _db.GetCollection<UserLocation>("user_locations");
        try
        {
            userLocations.Indexes.CreateOne(
                new CreateIndexModel<UserLocation>(
                    Builders<UserLocation>.IndexKeys.Geo2DSphere(x => x.Location),
                    new CreateIndexOptions { Name = "ix_user_locations_2dsphere", Background = true }));

            // TTL index for old locations (48 hours)
            userLocations.Indexes.CreateOne(
                new CreateIndexModel<UserLocation>(
                    Builders<UserLocation>.IndexKeys.Ascending(x => x.UpdatedAtUtc),
                    new CreateIndexOptions 
                    { 
                        Name = "ix_user_locations_ttl",
                        ExpireAfter = TimeSpan.FromHours(48),
                        Background = true 
                    }));
        }
        catch (MongoCommandException)
        {
            // Index already exists, ignore
        }
    }

    public Task InsertAsync(Notification n, CancellationToken ct) =>
        _notifs.InsertOneAsync(n, cancellationToken: ct);

    public async Task MarkReadAsync(IEnumerable<string> ids, Guid userId, CancellationToken ct)
    {
        var idList = ids.ToList();
        FilterDefinition<Notification> filter;
        
        if (idList.Count == 0)
        {
            // Empty list means mark all notifications as read for the user
            filter = Builders<Notification>.Filter.Eq(x => x.UserId, userId) &
                     Builders<Notification>.Filter.Eq(x => x.ReadAtUtc, null); // Only unread ones
        }
        else
        {
            // Mark specific notifications as read
            var objIds = idList.Select(ObjectId.Parse).ToList();
            filter = Builders<Notification>.Filter.In("_id", objIds) &
                     Builders<Notification>.Filter.Eq(x => x.UserId, userId);
        }
        
        var update = Builders<Notification>.Update.Set(x => x.ReadAtUtc, DateTime.UtcNow);
        await _notifs.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    public async Task<(IReadOnlyList<Notification> Items, string? NextCursor)> ListAsync(Guid userId, int limit, string? cursor, CancellationToken ct)
    {
        var filter = Builders<Notification>.Filter.Eq(x => x.UserId, userId);
        if (!string.IsNullOrWhiteSpace(cursor) && ObjectId.TryParse(cursor, out var oid))
            filter &= Builders<Notification>.Filter.Lt("_id", oid);

        var list = await _notifs.Find(filter)
                                .SortByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.Id)
                                .Limit(limit)
                                .ToListAsync(ct);

        var next = (list.Count == limit && list.Last().Id is not null) ? list.Last().Id : null;
        return (list, next);
    }

    public Task<long> UnreadCountAsync(Guid userId, CancellationToken ct) =>
        _notifs.CountDocumentsAsync(x => x.UserId == userId && x.ReadAtUtc == null, cancellationToken: ct);

    public async Task UpsertAsync(DeviceToken token, CancellationToken ct)
    {
        var filter = Builders<DeviceToken>.Filter.Eq(x => x.UserId, token.UserId) &
                     Builders<DeviceToken>.Filter.Eq(x => x.Token, token.Token);
        await _tokens.ReplaceOneAsync(filter, token, new ReplaceOptions{ IsUpsert = true }, ct);
    }

    public async Task<IReadOnlyList<DeviceToken>> GetByUserIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var arr = userIds.ToArray();
        var list = await _tokens.Find(x => arr.Contains(x.UserId)).ToListAsync(ct);
        return list;
    }
}