using Blinkr.Projections.Worker.Documents;
using MassTransit;
using MongoDB.Driver;
using Shared.Events.Events.Blog;

namespace Blinkr.Projections.Worker.Consumers;

public class PostCreatedConsumer : IConsumer<PostCreatedIntegrationEvent>
{
    private readonly IMongoCollection<PostDocument> _postsCollection;
    private readonly ILogger<PostCreatedConsumer> _logger;

    public PostCreatedConsumer(IMongoDatabase database, ILogger<PostCreatedConsumer> logger)
    {
        _postsCollection = database.GetCollection<PostDocument>("posts");
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PostCreatedIntegrationEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("Received PostCreatedIntegrationEvent for PostId: {PostId}", message.PostId);

        var existingPost = await (await _postsCollection.FindAsync(p => p.Id == message.PostId)).FirstOrDefaultAsync();
        if (existingPost != null)
        {
            _logger.LogWarning("Post with Id {PostId} already exists. Skipping creation.", message.PostId);
            return;
        }

        var newPost = new PostDocument
        {
            Id = message.PostId,
            AuthorId = message.AuthorId,
            Title = message.Title ?? string.Empty,
            Content = message.Content ?? string.Empty,
            CreatedAtUtc = message.OccurredOn,
            LikeCount = 0
        };

        await _postsCollection.InsertOneAsync(newPost);

        _logger.LogInformation("Successfully created PostDocument in MongoDB for PostId: {PostId}", newPost.Id);
    }
}
