using MongoDB.Bson;
using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Repositories;

public class MongoConversationRepository : IConversationRepository
{
    private readonly IMongoCollection<Conversation> _conversations;

    public MongoConversationRepository(IMongoDatabase db)
    {
        _conversations = db.GetCollection<Conversation>("conversations");
        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        _conversations.Indexes.CreateOne(
            new CreateIndexModel<Conversation>(
                Builders<Conversation>.IndexKeys.Ascending(x => x.ParticipantIds).Descending(x => x.LastMessageAtUtc)));
    }

    public async Task<Conversation> GetOrCreateAsync(Guid userId, Guid targetUserId, CancellationToken ct)
    {
        var filter = Builders<Conversation>.Filter.All(x => x.ParticipantIds, new[] { userId, targetUserId }) &
                     Builders<Conversation>.Filter.Size(x => x.ParticipantIds, 2);

        var existing = await _conversations.Find(filter).FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        var conversation = new Conversation
        {
            ParticipantIds = new List<Guid> { userId, targetUserId },
            CreatedAtUtc = DateTime.UtcNow,
            LastMessageAtUtc = DateTime.UtcNow,
        };

        try
        {
            await _conversations.InsertOneAsync(conversation, cancellationToken: ct);
        }
        catch (MongoWriteException)
        {
            var raced = await _conversations.Find(filter).FirstOrDefaultAsync(ct);
            if (raced is not null) return raced;
            throw;
        }

        return conversation;
    }

    public Task<Conversation?> GetByIdAsync(string conversationId, CancellationToken ct)
    {
        if (!ObjectId.TryParse(conversationId, out _)) return Task.FromResult<Conversation?>(null);
        return _conversations.Find(x => x.Id == conversationId).FirstOrDefaultAsync(ct)!;
    }

    public async Task<IReadOnlyList<Conversation>> ListForUserAsync(Guid userId, CancellationToken ct)
    {
        var filter = Builders<Conversation>.Filter.AnyEq(x => x.ParticipantIds, userId);
        return await _conversations.Find(filter)
            .SortByDescending(x => x.LastMessageAtUtc)
            .Limit(100)
            .ToListAsync(ct);
    }

    public Task UpdateLastMessageAsync(string conversationId, Guid senderId, string preview, DateTime atUtc, string kind, string? messageId, CancellationToken ct)
    {
        var update = Builders<Conversation>.Update
            .Set(x => x.LastMessageAtUtc, atUtc)
            .Set(x => x.LastMessagePreview, preview)
            .Set(x => x.LastMessageSenderId, senderId)
            .Set(x => x.LastMessageKind, kind)
            .Set(x => x.LastMessageId, messageId);

        return _conversations.UpdateOneAsync(x => x.Id == conversationId, update, cancellationToken: ct);
    }
}
