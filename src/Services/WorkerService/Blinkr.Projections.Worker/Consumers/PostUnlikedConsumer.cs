using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>
/// A like or reaction taken back (V2-4, D-027). Removes my entry only if it is not newer than this message (a quick
/// unlike + like that arrive out of order keep the like), and counts down only when something was really removed, so
/// LikeCount can never drift below the number of likers. A like from before reactions (no entry) is removed by id.
/// </summary>
public class PostUnlikedConsumer : IConsumer<PostUnlikedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostUnlikedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostUnlikedConsumer(IMongoDatabase database, ILogger<PostUnlikedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostUnlikedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostUnlikedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName)) return;

        var message = context.Message;
        try
        {
            var outcome = await ApplyAsync(_postsCollection, message.PostId, message.LikerUserId, message.OccurredAtUtc == default ? message.OccurredOn : message.OccurredAtUtc);
            _logger.LogInformation("Unlike projected | PostId={PostId} | Outcome={Outcome}", message.PostId, outcome);
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostUnlikedIntegrationEvent for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }

    public static async Task<string> ApplyAsync(IMongoCollection<PostDocument> posts, Guid postId, Guid userId, DateTime at)
    {
        var f = Builders<PostDocument>.Filter;
        var u = Builders<PostDocument>.Update;
        var byPost = f.Eq(p => p.Id, postId);

        var removed = await posts.UpdateOneAsync(
            f.And(byPost, f.ElemMatch(p => p.Reactions, r => r.UserId == userId && r.AtUtc <= at), f.Gt(p => p.LikeCount, 0)),
            u.PullFilter(p => p.Reactions, r => r.UserId == userId).Pull(p => p.LikedByUserIds, userId).Inc(p => p.LikeCount, -1));
        if (removed.ModifiedCount > 0) return "removed";

        if (await posts.CountDocumentsAsync(f.And(byPost, f.ElemMatch(p => p.Reactions, r => r.UserId == userId))) > 0) return "stale";

        var legacy = await posts.UpdateOneAsync(
            f.And(byPost, f.AnyEq(p => p.LikedByUserIds, userId), f.Gt(p => p.LikeCount, 0)),
            u.Pull(p => p.LikedByUserIds, userId).Inc(p => p.LikeCount, -1));
        return legacy.ModifiedCount > 0 ? "legacy" : "nothing";
    }
}
