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

    public async Task<Notification?> UpsertGroupedAsync(Notification n, TimeSpan window, Func<IReadOnlyList<string>, int, string> bodyOf, CancellationToken ct)
    {
        var actor = n.ActorUserId ?? Guid.Empty;
        var name = n.ActorUserName ?? string.Empty;
        var now = DateTime.UtcNow;
        var f = Builders<Notification>.Filter;
        var open = f.Eq(x => x.UserId, n.UserId) & f.Eq(x => x.GroupKey, n.GroupKey) & f.Gte(x => x.CreatedAtUtc, now - window);
        var existing = await _notifs.Find(open).SortByDescending(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
        if (existing is null)
        {
            n.ActorIds = actor == Guid.Empty ? new List<Guid>() : new List<Guid> { actor };
            n.ActorNames = string.IsNullOrWhiteSpace(name) ? new List<string>() : new List<string> { name };
            n.ActorCount = 1;
            n.Content.Body = bodyOf(n.ActorNames, 1);
            n.CreatedAtUtc = now;
            await _notifs.InsertOneAsync(n, cancellationToken: ct);
            return n;
        }
        if (actor != Guid.Empty && (existing.ActorIds ?? new List<Guid>()).Contains(actor)) return null;

        var names = new List<string>();
        if (!string.IsNullOrWhiteSpace(name)) names.Add(name);
        names.AddRange((existing.ActorNames ?? new List<string>()).Where(x => x != name));
        names = names.Take(3).ToList();
        var count = Math.Max(1, existing.ActorCount) + 1;
        var update = Builders<Notification>.Update
            .AddToSet(x => x.ActorIds, actor)
            .Set(x => x.ActorNames, names)
            .Set(x => x.ActorCount, count)
            .Set(x => x.ActorUserId, n.ActorUserId)
            .Set(x => x.ActorUserName, n.ActorUserName)
            .Set(x => x.Content.Body, bodyOf(names, count))
            .Set(x => x.CreatedAtUtc, now)
            .Set(x => x.ReadAtUtc, null);
        return await _notifs.FindOneAndUpdateAsync(f.Eq(x => x.Id, existing.Id), update,
            new FindOneAndUpdateOptions<Notification> { ReturnDocument = ReturnDocument.After }, ct);
    }

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