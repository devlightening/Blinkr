using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Entities;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostCommentAddedConsumer : IConsumer<PostCommentAddedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostCommentAddedConsumer> _logger;

    public PostCommentAddedConsumer(IMongoDatabase database, ILogger<PostCommentAddedConsumer> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PostCommentAddedIntegrationEvent> context)
    {
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PostCommentAddedIntegrationEvent for PostId: {PostId}", message.PostId);
            throw;
        }
    }
}
