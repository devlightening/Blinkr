using BlogService.Application.Common.ReadModels;
using Shared.Events.Text;

namespace BlogService.Application.Services;

/// <summary>A person @mentioned in a post or comment, as shown to readers (a link to their profile).</summary>
public record MentionDto(Guid UserId, string UserName);

/// <summary>
/// V2-4 (D-027): reactions, comment likes and mentions as a reader sees them, from the read model. Likes projected
/// before reactions existed have no emoji entry and count as the heart.
/// </summary>
public static class PostEngagement
{
    public static Dictionary<string, int> ReactionCounts(PostDocument post)
    {
        var entries = post.Reactions ?? new List<PostReactionReadModel>();
        var counts = entries.GroupBy(r => ReactionCatalog.OrHeart(r.Reaction)).ToDictionary(g => g.Key, g => g.Count());
        var legacy = (post.LikedByUserIds ?? new List<Guid>()).Count(id => entries.All(r => r.UserId != id));
        if (legacy > 0) counts[ReactionCatalog.Heart] = counts.GetValueOrDefault(ReactionCatalog.Heart) + legacy;
        return counts;
    }

    public static string? MyReaction(PostDocument post, Guid? viewerId)
    {
        if (viewerId is not { } me) return null;
        var mine = post.Reactions?.FirstOrDefault(r => r.UserId == me);
        if (mine is not null) return ReactionCatalog.OrHeart(mine.Reaction);
        return post.LikedByUserIds?.Contains(me) == true ? ReactionCatalog.Heart : null;
    }

    public static List<MentionDto> Mentions(List<MentionReadModel>? mentions) =>
        (mentions ?? new List<MentionReadModel>()).Select(m => new MentionDto(m.UserId, m.UserName)).ToList();
}
