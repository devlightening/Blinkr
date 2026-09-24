using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;
using Shared.Events.Text;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// A like or reaction (V2-4, D-027). Each person has one entry in <see cref="PostDocument.Reactions"/> stamped with when
/// it was set, so the projection is right whatever order RabbitMQ delivers in:
/// <list type="number">
/// <item>an entry of mine older than this message: change its emoji in place (a changed reaction, no count change);</item>
/// <item>an entry of mine newer than this message: this one is stale, ignore it;</item>
/// <item>no entry and not counted yet: add the entry, the liker id and one to LikeCount;</item>
/// <item>no entry but already counted (a like from before reactions): add the entry only.</item>
/// </list>
/// </summary>
public class PostLikedConsumer : IConsumer<PostLikedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostLikedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostLikedConsumer(IMongoDatabase database, ILogger<PostLikedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostLikedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostLikedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName)) return;

        var message = context.Message;
        try
        {
            var outcome = await ApplyAsync(_postsCollection, message.PostId, message.LikerUserId, ReactionCatalog.OrHeart(message.Reaction), message.OccurredAtUtc == default ? message.OccurredOn : message.OccurredAtUtc);
            _logger.LogInformation("Reaction projected | PostId={PostId} | Outcome={Outcome}", message.PostId, outcome);
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostLikedIntegrationEvent for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }

    public static async Task<string> ApplyAsync(IMongoCollection<PostDocument> posts, Guid postId, Guid userId, string reaction, DateTime at)
    {
        var f = Builders<PostDocument>.Filter;
        var u = Builders<PostDocument>.Update;
        var byPost = f.Eq(p => p.Id, postId);

        var changed = await posts.UpdateOneAsync(
            f.And(byPost, f.ElemMatch(p => p.Reactions, r => r.UserId == userId && r.AtUtc <= at)),
            u.Set("Reactions.$.Reaction", reaction).Set("Reactions.$.AtUtc", at));
        if (changed.MatchedCount > 0) return "changed";

        if (await posts.CountDocumentsAsync(f.And(byPost, f.ElemMatch(p => p.Reactions, r => r.UserId == userId))) > 0) return "stale";

        var entry = new ReactionEntry { UserId = userId, Reaction = reaction, AtUtc = at };
        var added = await posts.UpdateOneAsync(
            f.And(byPost, f.Not(f.AnyEq(p => p.LikedByUserIds, userId))),
            u.Push(p => p.Reactions, entry).AddToSet(p => p.LikedByUserIds, userId).Inc(p => p.LikeCount, 1));
        if (added.MatchedCount > 0) return "added";

        var legacy = await posts.UpdateOneAsync(
            f.And(byPost, f.Not(f.ElemMatch(p => p.Reactions, r => r.UserId == userId))),
            u.Push(p => p.Reactions, entry));
        return legacy.MatchedCount > 0 ? "legacy" : "no-post";
    }
}
