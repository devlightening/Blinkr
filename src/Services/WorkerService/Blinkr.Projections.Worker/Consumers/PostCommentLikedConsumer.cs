using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Entities;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>V2-4 (D-027): a comment like. The likers are a set, so a replay can never count twice.</summary>
public class PostCommentLikedConsumer : IConsumer<PostCommentLikedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _posts;
    private readonly ILogger<PostCommentLikedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostCommentLikedConsumer(IMongoDatabase database, ILogger<PostCommentLikedConsumer> logger, ProjectionInbox inbox)
    {
        _posts = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostCommentLikedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostCommentLikedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName)) return;
        var m = context.Message;
        try
        {
            var result = await _posts.UpdateOneAsync(
                Builders<PostDocument>.Filter.And(
                    Builders<PostDocument>.Filter.Eq(p => p.Id, m.PostId),
                    Builders<PostDocument>.Filter.ElemMatch(p => p.Comments, Builders<Comment>.Filter.Eq(c => c.Id, m.CommentId))),
                Builders<PostDocument>.Update.AddToSet<Guid>("Comments.$.LikedBy", m.UserId));
            _logger.LogInformation("Comment like projected | PostId={PostId} | CommentId={CommentId} | Matched={Matched}", m.PostId, m.CommentId, result.MatchedCount);
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error projecting comment like for PostId: {PostId}", m.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}

/// <summary>V2-4 (D-027): a comment like taken back.</summary>
public class PostCommentUnlikedConsumer : IConsumer<PostCommentUnlikedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _posts;
    private readonly ILogger<PostCommentUnlikedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostCommentUnlikedConsumer(IMongoDatabase database, ILogger<PostCommentUnlikedConsumer> logger, ProjectionInbox inbox)
    {
        _posts = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostCommentUnlikedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostCommentUnlikedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName)) return;
        var m = context.Message;
        try
        {
            await _posts.UpdateOneAsync(
                Builders<PostDocument>.Filter.And(
                    Builders<PostDocument>.Filter.Eq(p => p.Id, m.PostId),
                    Builders<PostDocument>.Filter.ElemMatch(p => p.Comments, Builders<Comment>.Filter.Eq(c => c.Id, m.CommentId))),
                Builders<PostDocument>.Update.Pull<Guid>("Comments.$.LikedBy", m.UserId));
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error projecting comment unlike for PostId: {PostId}", m.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
