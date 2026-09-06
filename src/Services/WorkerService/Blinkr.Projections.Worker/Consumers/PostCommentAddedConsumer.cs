using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Entities;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

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
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        _logger.LogInformation(
            "WS-07-LIKE-TOGGLE-FULL-FIX: Received PostUnlikedIntegrationEvent for PostId: {PostId}, LikerId: {LikerId}",
            message.PostId, message.LikerUserId);

        try
        {
            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var update = Builders<PostDocument>.Update.Inc(p => p.LikeCount, -1);

            var result = await _postsCollection.UpdateOneAsync(filter, update);

            if (result.MatchedCount == 0)
            {
                _logger.LogWarning(
                    "WS-07-LIKE-TOGGLE-FULL-FIX: Post not found for PostId: {PostId}",
                    message.PostId);
            }
            else
            {
                _logger.LogInformation(
                    "WS-07-LIKE-TOGGLE-FULL-FIX: Successfully decremented like count for PostId: {PostId}",
                    message.PostId);
            }

            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "WS-07-LIKE-TOGGLE-FULL-FIX: Error processing PostUnlikedIntegrationEvent for PostId: {PostId}",
                message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}

public class PostCommentAddedConsumer : IConsumer<PostCommentAddedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostCommentAddedConsumer> _logger;
    private readonly ProjectionInbox _inbox;

    public PostCommentAddedConsumer(IMongoDatabase database, ILogger<PostCommentAddedConsumer> logger, ProjectionInbox inbox)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
        _inbox = inbox;
    }

    public async Task Consume(ConsumeContext<PostCommentAddedIntegrationEvent> context)
    {
        const string consumerName = nameof(PostCommentAddedConsumer);
        if (!await _inbox.TryBeginAsync(context, consumerName))
        {
            return;
        }

        var message = context.Message;
        _logger.LogInformation("Received PostCommentAddedIntegrationEvent for PostId: {PostId}, CommentId: {CommentId}", 
            message.PostId, message.CommentId);

        try
        {
            var comment = new Comment
            {
                Id = message.CommentId,
                AuthorId = message.AuthorId,
                Text = message.CommentText,
                CreatedAtUtc = message.OccurredOn
            };

            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId);
            var update = Builders<PostDocument>.Update.Push(p => p.Comments, comment);

            var result = await _postsCollection.UpdateOneAsync(filter, update);

            if (result.MatchedCount == 0)
            {
                _logger.LogWarning("Post not found for PostId: {PostId}", message.PostId);
            }
            else
            {
                _logger.LogInformation("Successfully added comment to PostId: {PostId}", message.PostId);
            }

            await _inbox.MarkProcessedAsync(context, consumerName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostCommentAddedIntegrationEvent for PostId: {PostId}", message.PostId);
            await _inbox.ReleaseAsync(context, consumerName);
            throw;
        }
    }
}
