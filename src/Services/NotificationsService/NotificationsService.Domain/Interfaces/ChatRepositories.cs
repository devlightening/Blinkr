using NotificationsService.Domain.Entities;

namespace NotificationsService.Domain.Interfaces;

public interface IConversationRepository
{
    Task<Conversation> GetOrCreateAsync(Guid userId, Guid targetUserId, CancellationToken ct);
    Task<Conversation?> GetByIdAsync(string conversationId, CancellationToken ct);
    Task<IReadOnlyList<Conversation>> ListForUserAsync(Guid userId, CancellationToken ct);
    Task UpdateLastMessageAsync(string conversationId, Guid senderId, string preview, DateTime atUtc, string kind, string? messageId, CancellationToken ct);
}

/// <summary>Per-person conversation settings (pin, mute). See <see cref="ConversationPreference"/>.</summary>
public interface IConversationPreferenceRepository
{
    Task<ConversationPreference?> GetAsync(Guid userId, string conversationId, CancellationToken ct);

    /// <summary>This person's settings for the given conversations, keyed by conversation id; ones with nothing set are absent.</summary>
    Task<IReadOnlyDictionary<string, ConversationPreference>> GetManyAsync(Guid userId, IReadOnlyCollection<string> conversationIds, CancellationToken ct);

    /// <summary>How many conversations this person has pinned, not counting <paramref name="exceptConversationId"/>.</summary>
    Task<int> CountPinnedAsync(Guid userId, string exceptConversationId, CancellationToken ct);

    /// <summary>Stores the settings, or removes the row when nothing is set. Idempotent.</summary>
    Task SaveAsync(ConversationPreference preference, CancellationToken ct);

    /// <summary>Account deletion: forgets every setting of this person.</summary>
    Task DeleteForUserAsync(Guid userId, CancellationToken ct);
}

public interface IChatMessageRepository
{
    Task<ChatMessage> InsertAsync(ChatMessage message, CancellationToken ct);
    Task<(IReadOnlyList<ChatMessage> Items, string? NextCursor)> ListByConversationAsync(string conversationId, int limit, string? beforeCursor, CancellationToken ct);
    Task MarkReadAsync(string conversationId, Guid userId, CancellationToken ct);

    /// <summary>Blanks every quote of a taken-back message, so its text is gone everywhere.</summary>
    Task ClearQuotesAsync(string conversationId, string messageId, CancellationToken ct);

    /// <summary>Messages from other participants that <paramref name="userId"/> has not read, per conversation. Conversations with none are absent.</summary>
    Task<IReadOnlyDictionary<string, int>> CountUnreadAsync(IReadOnlyCollection<string> conversationIds, Guid userId, CancellationToken ct);

    Task<ChatMessage?> GetByIdAsync(string messageId, CancellationToken ct);
    /// <summary>The message this sender already sent with this client id in this conversation, if any.</summary>
    Task<ChatMessage?> FindByClientIdAsync(string conversationId, Guid senderId, string clientId, CancellationToken ct);
    Task ReplaceAsync(ChatMessage message, CancellationToken ct);
    Task<IReadOnlyList<ChatMessage>> GetManyAsync(IReadOnlyCollection<string> messageIds, CancellationToken ct);

    /// <summary>
    /// Atomically moves a waiting, unexpired snap of someone else to "opened" and marks it read for the viewer.
    /// Returns null when nothing matched (already opened, expired, own snap, not a snap). Exactly one caller wins.
    /// </summary>
    Task<ChatMessage?> TryOpenSnapAsync(string messageId, Guid viewerId, DateTime nowUtc, CancellationToken ct);

    /// <summary>Snaps whose file can be deleted: opened long enough ago, or waiting past their expiry.</summary>
    Task<IReadOnlyList<ChatMessage>> ListPurgeableSnapsAsync(DateTime openedBeforeUtc, DateTime nowUtc, int limit, CancellationToken ct);

    /// <summary>Forgets the file of a snap (and expires it if nobody ever opened it).</summary>
    Task MarkSnapPurgedAsync(string messageId, CancellationToken ct);
}

/// <summary>Private, non-public storage for snap media.</summary>
public interface ISnapStorage
{
    Task SaveAsync(string key, byte[] content, CancellationToken ct);
    Task<byte[]?> ReadAsync(string key, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
}
