using MongoDB.Driver;
using PlaceService.Api.Domain;

namespace PlaceService.Api.Infrastructure;

/// <summary>Storage for place attribute votes (D-040) and the eligibility check behind them.</summary>
public interface IPlaceAttributeRepository
{
    Task<IReadOnlyList<PlaceAttributeVoteDocument>> ListForPlaceAsync(Guid placeId, DateTime sinceUtc, CancellationToken ct);
    /// <summary>One vote per person, place and fact: a new answer replaces the old one and refreshes its time.</summary>
    Task SetAsync(Guid placeId, string key, Guid userId, bool value, DateTime nowUtc, CancellationToken ct);
    Task RemoveAsync(Guid placeId, string key, Guid userId, CancellationToken ct);
    Task<int> CountVotesSinceAsync(Guid userId, DateTime sinceUtc, CancellationToken ct);
    /// <summary>Did this person publish a server-verified (VERIFIED_LIVE) signal at this place since then?</summary>
    Task<bool> HasVerifiedSignalAsync(Guid placeId, Guid userId, DateTime sinceUtc, CancellationToken ct);
    Task DeleteForUserAsync(Guid userId, CancellationToken ct);
    Task EnsureIndexesAsync(CancellationToken ct);
}

public sealed class PlaceAttributeRepository : IPlaceAttributeRepository
{
    private readonly IMongoCollection<PlaceAttributeVoteDocument> _votes;
    private readonly IMongoCollection<PlaceSignalDocument> _signals;

    public PlaceAttributeRepository(IMongoDatabase database)
    {
        _votes = database.GetCollection<PlaceAttributeVoteDocument>("place_attribute_votes");
        _signals = database.GetCollection<PlaceSignalDocument>("place_signals");
    }

    private static FilterDefinitionBuilder<PlaceAttributeVoteDocument> F => Builders<PlaceAttributeVoteDocument>.Filter;

    public async Task<IReadOnlyList<PlaceAttributeVoteDocument>> ListForPlaceAsync(Guid placeId, DateTime sinceUtc, CancellationToken ct) =>
        await _votes.Find(F.Eq(v => v.PlaceId, placeId) & F.Gte(v => v.VotedAtUtc, sinceUtc)).Limit(5000).ToListAsync(ct);

    public async Task SetAsync(Guid placeId, string key, Guid userId, bool value, DateTime nowUtc, CancellationToken ct)
    {
        var filter = F.Eq(v => v.PlaceId, placeId) & F.Eq(v => v.Key, key) & F.Eq(v => v.UserId, userId);
        var update = Builders<PlaceAttributeVoteDocument>.Update
            .SetOnInsert(v => v.PlaceId, placeId).SetOnInsert(v => v.Key, key).SetOnInsert(v => v.UserId, userId)
            .Set(v => v.Value, value).Set(v => v.VotedAtUtc, nowUtc);
        try
        {
            await _votes.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true }, ct);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            await _votes.UpdateOneAsync(filter, update, cancellationToken: ct);
        }
    }

    public Task RemoveAsync(Guid placeId, string key, Guid userId, CancellationToken ct) =>
        _votes.DeleteOneAsync(F.Eq(v => v.PlaceId, placeId) & F.Eq(v => v.Key, key) & F.Eq(v => v.UserId, userId), ct);

    public async Task<int> CountVotesSinceAsync(Guid userId, DateTime sinceUtc, CancellationToken ct) =>
        (int)await _votes.CountDocumentsAsync(F.Eq(v => v.UserId, userId) & F.Gte(v => v.VotedAtUtc, sinceUtc), cancellationToken: ct);

    public async Task<bool> HasVerifiedSignalAsync(Guid placeId, Guid userId, DateTime sinceUtc, CancellationToken ct)
    {
        var s = Builders<PlaceSignalDocument>.Filter;
        var filter = s.Eq(x => x.PlaceId, placeId) & s.Eq(x => x.AuthorId, userId) & s.Eq(x => x.PublicationTrust, "VERIFIED_LIVE") & s.Gte(x => x.CreatedAtUtc, sinceUtc);
        return await _signals.Find(filter).Limit(1).AnyAsync(ct);
    }

    public Task DeleteForUserAsync(Guid userId, CancellationToken ct) => _votes.DeleteManyAsync(F.Eq(v => v.UserId, userId), ct);

    public async Task EnsureIndexesAsync(CancellationToken ct)
    {
        var keys = Builders<PlaceAttributeVoteDocument>.IndexKeys;
        await _votes.Indexes.CreateManyAsync(new[]
        {
            new CreateIndexModel<PlaceAttributeVoteDocument>(keys.Ascending(v => v.PlaceId).Ascending(v => v.Key).Ascending(v => v.UserId), new CreateIndexOptions { Unique = true, Name = "ux_place_attribute_votes" }),
            new CreateIndexModel<PlaceAttributeVoteDocument>(keys.Ascending(v => v.UserId).Descending(v => v.VotedAtUtc), new CreateIndexOptions { Name = "ix_place_attribute_votes_user" }),
            // Forgotten facts leave the database too (a year, well past the 180 days they are shown).
            new CreateIndexModel<PlaceAttributeVoteDocument>(keys.Ascending(v => v.VotedAtUtc), new CreateIndexOptions { Name = "ttl_place_attribute_votes", ExpireAfter = TimeSpan.FromDays(365) }),
        }, ct);
    }
}
