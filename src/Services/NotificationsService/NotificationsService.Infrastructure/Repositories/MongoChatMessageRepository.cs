using MongoDB.Bson;
using MongoDB.Driver;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Infrastructure.Repositories;

public class MongoChatMessageRepository : IChatMessageRepository
{
    private readonly IMongoCollection<ChatMessage> _messages;

    public MongoChatMessageRepository(IMongoDatabase db)
    {
        _messages = db.GetCollection<ChatMessage>("chat_messages");
        EnsureIndexes();
    }

    private void EnsureIndexes()
    {
        _messages.Indexes.CreateOne(
            new CreateIndexModel<ChatMessage>(
                Builders<ChatMessage>.IndexKeys.Ascending(x => x.ConversationId).Descending(x => x.CreatedAtUtc)));
    }

    public async Task<ChatMessage> InsertAsync(ChatMessage message, CancellationToken ct)
    {
        await _messages.InsertOneAsync(message, cancellationToken: ct);
        return message;
    }

    public async Task<(IReadOnlyList<ChatMessage> Items, string? NextCursor)> ListByConversationAsync(string conversationId, int limit, string? beforeCursor, CancellationToken ct)
    {
        var filter = Builders<ChatMessage>.Filter.Eq(x => x.ConversationId, conversationId);
        if (!string.IsNullOrWhiteSpace(beforeCursor) && ObjectId.TryParse(beforeCursor, out var oid))
            filter &= Builders<ChatMessage>.Filter.Lt("_id", oid);

        var list = await _messages.Find(filter)
            .SortByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.Id)
            .Limit(limit)
            .ToListAsync(ct);

        var next = (list.Count == limit && list.Last().Id is not null) ? list.Last().Id : null;
        return (list, next);
    }

    public async Task MarkReadAsync(string conversationId, Guid userId, CancellationToken ct)
    {
        var filter = Builders<ChatMessage>.Filter.Eq(x => x.ConversationId, conversationId) &
                     Builders<ChatMessage>.Filter.Ne(x => x.SenderId, userId) &
                     Builders<ChatMessage>.Filter.Not(Builders<ChatMessage>.Filter.AnyEq(x => x.ReadByUserIds, userId));

        var update = Builders<ChatMessage>.Update.AddToSet(x => x.ReadByUserIds, userId);
        await _messages.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    public async Task<IReadOnlyDictionary<string, int>> CountUnreadAsync(IReadOnlyCollection<string> conversationIds, Guid userId, CancellationToken ct)
    {
        if (conversationIds.Count == 0) return new Dictionary<string, int>();

        // Same predicate MarkReadAsync clears, so "unread" and "mark read" can never disagree.
        var filter = Builders<ChatMessage>.Filter.In(x => x.ConversationId, conversationIds) &
                     Builders<ChatMessage>.Filter.Ne(x => x.SenderId, userId) &
                     Builders<ChatMessage>.Filter.Not(Builders<ChatMessage>.Filter.AnyEq(x => x.ReadByUserIds, userId));

        var groups = await _messages.Aggregate()
            .Match(filter)
            .Group(x => x.ConversationId, g => new { ConversationId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return groups.ToDictionary(x => x.ConversationId, x => x.Count);
    }
}
