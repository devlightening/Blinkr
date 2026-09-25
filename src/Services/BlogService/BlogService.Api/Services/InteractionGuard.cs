using BlogService.Infrastructure.ReadModels;
using MongoDB.Driver;

namespace BlogService.Api.Services;

public enum InteractionCheck { Allowed, Blocked, Unavailable }

/// <summary>
/// Blocks on comments and reactions (CLAUDE.md §2.2: every surface where people touch has blocking). Before someone
/// comments, replies, reacts or likes a comment, the people on the other end (the signal's author, and the author of the
/// comment being answered or liked) are checked against the caller's blocks, both ways, read with the caller's own token.
///
/// - Blocked: the caller gets the same 404 a blocked profile gives, so the block is not revealed.
/// - Unavailable (IdentityService did not answer): the write closes, like chat (CHAT_UNAVAILABLE); a blocked person is
///   never let through on a guess.
/// - An anonymous signal's author is left out: refusing there would tell the blocked person who posted it
///   (CLAUDE.md §10.3). The same holds for that author's own comments under the anonymous signal.
/// - A signal not yet in the read model is allowed through; the command itself decides whether it exists.
/// </summary>
public sealed class InteractionGuard
{
    private readonly IMongoCollection<PostDocument> _posts;
    private readonly SocialGraphClient _graph;

    public InteractionGuard(IMongoDatabase database, SocialGraphClient graph)
    {
        _posts = database.GetCollection<PostDocument>("posts");
        _graph = graph;
    }

    public async Task<InteractionCheck> CheckAsync(Guid me, Guid postId, Guid? commentId, CancellationToken ct)
    {
        var projection = Builders<PostDocument>.Projection
            .Include(p => p.AuthorId)
            .Include(p => p.IdentityDisclosure)
            .Include("Comments._id")
            .Include("Comments.AuthorId");
        var post = await _posts.Find(p => p.Id == postId).Project<PostDocument>(projection).FirstOrDefaultAsync(ct);
        if (post is null) return InteractionCheck.Allowed;

        var anonymous = post.IdentityDisclosure == "AnonymousMap";
        var others = new HashSet<Guid>();
        if (!anonymous && post.AuthorId != me) others.Add(post.AuthorId);
        if (commentId is { } id && post.Comments?.FirstOrDefault(c => c.Id == id) is { } comment
            && comment.AuthorId != me && !(anonymous && comment.AuthorId == post.AuthorId))
            others.Add(comment.AuthorId);
        others.Remove(Guid.Empty);
        if (others.Count == 0) return InteractionCheck.Allowed;

        var graph = await _graph.GetAsync(ct);
        if (graph is null) return InteractionCheck.Unavailable;
        return others.Overlaps(graph.Hidden) ? InteractionCheck.Blocked : InteractionCheck.Allowed;
    }
}
