using MongoDB.Bson;
using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Repositories;

public class MongoNotificationRepository : INotificationRepository
{
    private readonly IMongoCollection<Notification> _notifs;
    private readonly IMongoDatabase _db;

    public MongoNotificationRepository(IMongoDatabase db)
    {
        _db = db;
        _notifs = db.GetCollection<Notification>("notifications");
        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        _notifs.Indexes.CreateOne(
            new CreateIndexModel<Notification>(
                Builders<Notification>.IndexKeys.Descending(x => x.UserId).Descending(x => x.CreatedAtUtc)));

        _notifs.Indexes.CreateOne(
            new CreateIndexModel<Notification>(
                Builders<Notification>.IndexKeys.Ascending(x => x.UserId).Ascending(x => x.ReadAtUtc)));

        var userLocations = _db.GetCollection<UserLocation>("user_locations");
        try
        {
            userLocations.Indexes.CreateOne(
                new CreateIndexModel<UserLocation>(
                    Builders<UserLocation>.IndexKeys.Geo2DSphere(x => x.Location),
                    new CreateIndexOptions { Name = "ix_user_locations_2dsphere", Background = true }));

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
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Warning: Failed to create indexes: {ex.Message}");
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
            filter = Builders<Notification>.Filter.Eq(x => x.UserId, userId) &
                     Builders<Notification>.Filter.Eq(x => x.ReadAtUtc, null);
        }
        else
        {
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
}