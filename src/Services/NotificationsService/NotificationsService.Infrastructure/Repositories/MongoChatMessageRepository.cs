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

    public Task<ChatMessage?> FindByClientIdAsync(string conversationId, Guid senderId, string clientId, CancellationToken ct) =>
        _messages.Find(x => x.ConversationId == conversationId && x.SenderId == senderId && x.ClientId == clientId).FirstOrDefaultAsync(ct)!;

    public Task ReplaceAsync(ChatMessage message, CancellationToken ct) =>
        _messages.ReplaceOneAsync(x => x.Id == message.Id, message, cancellationToken: ct);

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
        // Opening a conversation reads its text; a snap stays "new" until the person actually opens it.
        var filter = Builders<ChatMessage>.Filter.Eq(x => x.ConversationId, conversationId) &
                     Builders<ChatMessage>.Filter.Ne(x => x.SenderId, userId) &
                     Builders<ChatMessage>.Filter.Ne(x => x.Kind, "snap") &
                     Builders<ChatMessage>.Filter.Not(Builders<ChatMessage>.Filter.AnyEq(x => x.ReadByUserIds, userId));

        var update = Builders<ChatMessage>.Update.AddToSet(x => x.ReadByUserIds, userId).Set(x => x.ReadAtUtc, DateTime.UtcNow);
        await _messages.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    public async Task ClearQuotesAsync(string conversationId, string messageId, CancellationToken ct)
    {
        var filter = Builders<ChatMessage>.Filter.Eq(x => x.ConversationId, conversationId) & Builders<ChatMessage>.Filter.Eq("ReplyTo.MessageId", messageId);
        var update = Builders<ChatMessage>.Update.Set("ReplyTo.Text", string.Empty).Set("ReplyTo.Kind", "unsent");
        await _messages.UpdateManyAsync(filter, update, cancellationToken: ct);
    }

    public async Task<IReadOnlyDictionary<string, int>> CountUnreadAsync(IReadOnlyCollection<string> conversationIds, Guid userId, CancellationToken ct)
    {
        if (conversationIds.Count == 0) return new Dictionary<string, int>();

        // Text counts as MarkReadAsync clears it; a snap counts while it is still waiting and not expired.
        var f = Builders<ChatMessage>.Filter;
        var filter = f.In(x => x.ConversationId, conversationIds) &
                     f.Ne(x => x.SenderId, userId) &
                     f.Not(f.AnyEq(x => x.ReadByUserIds, userId)) &
                     (f.Ne(x => x.Kind, "snap") |
                      (f.Eq("Snap.State", SnapStates.Sent) & f.Gt("Snap.ExpiresAtUtc", DateTime.UtcNow)));

        var groups = await _messages.Aggregate()
            .Match(filter)
            .Group(x => x.ConversationId, g => new { ConversationId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return groups.ToDictionary(x => x.ConversationId, x => x.Count);
    }

    private static bool IsObjectId(string id) => ObjectId.TryParse(id, out _);

    public async Task<ChatMessage?> GetByIdAsync(string messageId, CancellationToken ct)
    {
        if (!IsObjectId(messageId)) return null;
        return await _messages.Find(x => x.Id == messageId).FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<ChatMessage>> GetManyAsync(IReadOnlyCollection<string> messageIds, CancellationToken ct)
    {
        var valid = messageIds.Where(IsObjectId).Select(id => ObjectId.Parse(id)).ToList();
        if (valid.Count == 0) return Array.Empty<ChatMessage>();
        return await _messages.Find(Builders<ChatMessage>.Filter.In("_id", valid)).ToListAsync(ct);
    }

    public async Task<ChatMessage?> TryOpenSnapAsync(string messageId, Guid viewerId, DateTime nowUtc, CancellationToken ct)
    {
        if (!IsObjectId(messageId)) return null;
        var f = Builders<ChatMessage>.Filter;
        var filter = f.Eq(x => x.Id, messageId) &
                     f.Eq(x => x.Kind, "snap") &
                     f.Ne(x => x.SenderId, viewerId) &
                     f.Eq("Snap.State", SnapStates.Sent) &
                     f.Gt("Snap.ExpiresAtUtc", nowUtc);
        var update = Builders<ChatMessage>.Update
            .Set("Snap.State", SnapStates.Opened)
            .Set("Snap.OpenedAtUtc", nowUtc)
            .AddToSet(x => x.ReadByUserIds, viewerId);
        // Exactly one caller flips sent -> opened; everyone else gets null.
        return await _messages.FindOneAndUpdateAsync(filter, update, new FindOneAndUpdateOptions<ChatMessage> { ReturnDocument = ReturnDocument.After }, ct);
    }

    public async Task<IReadOnlyList<ChatMessage>> ListPurgeableSnapsAsync(DateTime openedBeforeUtc, DateTime nowUtc, int limit, CancellationToken ct)
    {
        var f = Builders<ChatMessage>.Filter;
        var filter = f.Eq(x => x.Kind, "snap") &
                     f.Ne("Snap.ObjectKey", BsonNull.Value) &
                     f.Exists("Snap.ObjectKey") &
                     ((f.Eq("Snap.State", SnapStates.Opened) & f.Lt("Snap.OpenedAtUtc", openedBeforeUtc)) |
                      (f.Eq("Snap.State", SnapStates.Sent) & f.Lt("Snap.ExpiresAtUtc", nowUtc)) |
                      f.Eq("Snap.State", SnapStates.Expired));
        return await _messages.Find(filter).Limit(limit).ToListAsync(ct);
    }

    public async Task MarkSnapPurgedAsync(string messageId, CancellationToken ct)
    {
        if (!IsObjectId(messageId)) return;
        var f = Builders<ChatMessage>.Filter;
        // Never-opened snaps become "expired"; opened ones stay "opened" but lose their file.
        await _messages.UpdateOneAsync(f.Eq(x => x.Id, messageId) & f.Eq("Snap.State", SnapStates.Sent),
            Builders<ChatMessage>.Update.Set("Snap.State", SnapStates.Expired).Unset("Snap.ObjectKey"), cancellationToken: ct);
        await _messages.UpdateOneAsync(f.Eq(x => x.Id, messageId),
            Builders<ChatMessage>.Update.Unset("Snap.ObjectKey"), cancellationToken: ct);
    }
}
