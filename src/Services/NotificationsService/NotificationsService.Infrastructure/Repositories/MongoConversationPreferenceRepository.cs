using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Repositories;

public class MongoConversationPreferenceRepository : IConversationPreferenceRepository
{
    private readonly IMongoCollection<ConversationPreference> _preferences;

    public MongoConversationPreferenceRepository(IMongoDatabase db)
    {
        _preferences = db.GetCollection<ConversationPreference>("conversation_preferences");
        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        // One row per person and conversation; the unique key also makes concurrent saves converge on one row.
        _preferences.Indexes.CreateOne(new CreateIndexModel<ConversationPreference>(
            Builders<ConversationPreference>.IndexKeys.Ascending(x => x.UserId).Ascending(x => x.ConversationId),
            new CreateIndexOptions { Unique = true }));
    }

    private static FilterDefinition<ConversationPreference> Key(Guid userId, string conversationId) =>
        Builders<ConversationPreference>.Filter.Eq(x => x.UserId, userId) &
        Builders<ConversationPreference>.Filter.Eq(x => x.ConversationId, conversationId);

    public async Task<ConversationPreference?> GetAsync(Guid userId, string conversationId, CancellationToken ct) =>
        await _preferences.Find(Key(userId, conversationId)).FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyDictionary<string, ConversationPreference>> GetManyAsync(Guid userId, IReadOnlyCollection<string> conversationIds, CancellationToken ct)
    {
        if (conversationIds.Count == 0) return new Dictionary<string, ConversationPreference>();
        var filter = Builders<ConversationPreference>.Filter.Eq(x => x.UserId, userId) &
                     Builders<ConversationPreference>.Filter.In(x => x.ConversationId, conversationIds);
        var rows = await _preferences.Find(filter).ToListAsync(ct);
        return rows.GroupBy(x => x.ConversationId).ToDictionary(g => g.Key, g => g.First());
    }

    public async Task<int> CountPinnedAsync(Guid userId, string exceptConversationId, CancellationToken ct)
    {
        var filter = Builders<ConversationPreference>.Filter.Eq(x => x.UserId, userId) &
                     Builders<ConversationPreference>.Filter.Ne(x => x.PinnedAtUtc, null) &
                     Builders<ConversationPreference>.Filter.Ne(x => x.ConversationId, exceptConversationId);
        return (int)await _preferences.CountDocumentsAsync(filter, cancellationToken: ct);
    }

    public async Task SaveAsync(ConversationPreference preference, CancellationToken ct)
    {
        var key = Key(preference.UserId, preference.ConversationId);
        if (preference.IsEmpty)
        {
            await _preferences.DeleteOneAsync(key, ct);
            return;
        }

        var update = Builders<ConversationPreference>.Update
            .SetOnInsert(x => x.UserId, preference.UserId)
            .SetOnInsert(x => x.ConversationId, preference.ConversationId)
            .Set(x => x.PinnedAtUtc, preference.PinnedAtUtc)
            .Set(x => x.MutedAtUtc, preference.MutedAtUtc);
        try
        {
            await _preferences.UpdateOneAsync(key, update, new UpdateOptions { IsUpsert = true }, ct);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            // Two saves raced to insert the same row; the loser applies its values to the winner's row.
            await _preferences.UpdateOneAsync(key, update, cancellationToken: ct);
        }
    }

    public Task DeleteForUserAsync(Guid userId, CancellationToken ct) =>
        _preferences.DeleteManyAsync(x => x.UserId == userId, ct);
}
