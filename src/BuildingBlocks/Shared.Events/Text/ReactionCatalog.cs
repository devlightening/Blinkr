namespace Shared.Events.Text;

/// <summary>
/// Post reactions (V2-4, D-027): one per person, from a fixed set. A plain like is the heart; events written before
/// reactions existed carry no reaction and read as the heart too.
/// </summary>
public static class ReactionCatalog
{
    public const string Heart = "❤️";
    public static readonly IReadOnlyList<string> All = new[] { Heart, "🔥", "😂", "😮", "😢", "👏" };

    public static bool IsValid(string? reaction) => reaction is not null && All.Contains(reaction);

    /// <summary>The stored reaction, with a missing one read as the heart.</summary>
    public static string OrHeart(string? reaction) => IsValid(reaction) ? reaction! : Heart;
}
