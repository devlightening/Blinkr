using Blinkr.Projections.Worker.Documents;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Abstractions;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostCreatedConsumer : IConsumer<IPostCreatedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostCreatedConsumer> _logger;

    public PostCreatedConsumer(IMongoDatabase database, ILogger<PostCreatedConsumer> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<IPostCreatedIntegrationEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("📥 Received PostCreatedIntegrationEvent for PostId: {PostId}", message.PostId);

        try
        {
            var newPost = new PostDocument
            {
                Id = message.PostId,
                AuthorId = message.AuthorId,
                Title = message.Title ?? string.Empty,
                Content = message.Content ?? string.Empty,
                CreatedAtUtc = message.OccurredOn,
                LikeCount = 0
            };

            var filter = Builders<PostDocument>.Filter.Eq(p => p.Id, newPost.Id);
            var result = await _postsCollection.ReplaceOneAsync(filter, newPost, new ReplaceOptions { IsUpsert = true });
            
            _logger.LogInformation("✅ Successfully projected PostDocument to MongoDB. PostId: {PostId}, Matched: {Matched}, Modified: {Modified}", 
                message.PostId, result.MatchedCount, result.ModifiedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error projecting PostDocument to MongoDB. PostId: {PostId}", message.PostId);
            throw; // Re-throw to trigger MassTransit retry and eventually move to error queue
        }
    }
}