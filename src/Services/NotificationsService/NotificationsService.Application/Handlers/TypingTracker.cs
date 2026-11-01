using System.Collections.Concurrent;

namespace NotificationsService.Application.Handlers;

/// <summary>
/// Who is typing where (plan-devam E4). Kept in memory for a few seconds and never stored: the chat is polled
/// (CLAUDE.md §6.5), so "typing" is just a flag on the next poll. One service instance; see DECISIONS D-020.
/// </summary>
public sealed class TypingTracker
{
    public static readonly TimeSpan Window = TimeSpan.FromSeconds(6);
    private readonly ConcurrentDictionary<string, DateTime> _seen = new();

    public void Mark(string conversationId, Guid userId, DateTime nowUtc)
    {
        _seen[$"{conversationId}:{userId}"] = nowUtc;
        if (_seen.Count > 10_000)
            foreach (var old in _seen.Where(e => nowUtc - e.Value > Window).Select(e => e.Key).ToList()) _seen.TryRemove(old, out _);
    }

    public void Clear(string conversationId, Guid userId) => _seen.TryRemove($"{conversationId}:{userId}", out _);

    public bool IsTyping(string conversationId, Guid userId, DateTime nowUtc) =>
        _seen.TryGetValue($"{conversationId}:{userId}", out var at) && nowUtc - at <= Window;
}
