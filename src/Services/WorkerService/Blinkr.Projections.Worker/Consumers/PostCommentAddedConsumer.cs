using Blinkr.Projections.Worker.Documents;
using Blinkr.Projections.Worker.Entities;
using Blinkr.Projections.Worker.Infra;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

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
                AuthorName = string.IsNullOrWhiteSpace(message.CommentAuthorName) ? null : message.CommentAuthorName,
                ParentCommentId = message.ParentCommentId,
                Text = message.CommentText,
                CreatedAtUtc = message.OccurredOn,
                Mentions = message.Mentions is { Count: > 0 } mentions ? mentions.Select(m => new MentionEntry { UserId = m.UserId, UserName = m.UserName }).ToList() : null
            };

            // Never push the same comment twice, even if the inbox is bypassed by a replay.
            var filter = Builders<PostDocument>.Filter.And(
                Builders<PostDocument>.Filter.Eq(p => p.Id, message.PostId),
                Builders<PostDocument>.Filter.Not(
                    Builders<PostDocument>.Filter.ElemMatch(p => p.Comments,
                        Builders<Comment>.Filter.Eq(c => c.Id, message.CommentId))));
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
