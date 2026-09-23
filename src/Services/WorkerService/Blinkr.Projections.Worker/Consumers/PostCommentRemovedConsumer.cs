using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Entities;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

/// <summary>Removes a comment and its replies from the post read model. Pulling is idempotent by nature.</summary>
public class PostCommentRemovedConsumer : IConsumer<PostCommentRemovedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostCommentRemovedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostCommentRemovedConsumer(IMongoDatabase database, ILogger<PostCommentRemovedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostCommentRemovedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostCommentRemovedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var update = Builders<PostDocument>.Update.PullFilter(
                p => p.Comments,
                Builders<Comment>.Filter.Or(
                    Builders<Comment>.Filter.Eq(c => c.Id, message.CommentId),
                    Builders<Comment>.Filter.Eq(c => c.ParentCommentId, message.CommentId)));

            var result = await _postsCollection.UpdateOneAsync(filter, update);
            if (result.MatchedCount == 0)
            {
                _logger.LogWarning("Post not found for PostId: {PostId}", message.PostId);
            }

            _logger.LogInformation("Removed comment {CommentId} from PostId: {PostId}", message.CommentId, message.PostId);
            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostCommentRemovedIntegrationEvent for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
