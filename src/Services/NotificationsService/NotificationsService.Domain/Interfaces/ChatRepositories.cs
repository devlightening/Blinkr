using NotificationsService.Domain.Entities;

namespace NotificationsService.Domain.Interfaces;

public interface IConversationRepository
{
    Task<Conversation> GetOrCreateAsync(Guid userId, Guid targetUserId, CancellationToken ct);
    Task<Conversation?> GetByIdAsync(string conversationId, CancellationToken ct);
    Task<IReadOnlyList<Conversation>> ListForUserAsync(Guid userId, CancellationToken ct);
    Task UpdateLastMessageAsync(string conversationId, Guid senderId, string preview, DateTime atUtc, CancellationToken ct);
}

public interface IChatMessageRepository
{
    Task<ChatMessage> InsertAsync(ChatMessage message, CancellationToken ct);
    Task<(IReadOnlyList<ChatMessage> Items, string? NextCursor)> ListByConversationAsync(string conversationId, int limit, string? beforeCursor, CancellationToken ct);
    Task MarkReadAsync(string conversationId, Guid userId, CancellationToken ct);
}
