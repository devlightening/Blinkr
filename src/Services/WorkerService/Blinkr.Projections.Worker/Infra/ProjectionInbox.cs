using MassTransit;
using MongoDB.Bson;
using MongoDB.Driver;
using Shared.Events.Abstractions;

namespace Blinkr.Projections.Worker.Infra;

public sealed class ProjectionInbox
{
    private readonly IMongoCollection<BsonDocument> _processedMessages;
    private readonly ILogger<ProjectionInbox> _logger;

    public ProjectionInbox(IMongoDatabase database, ILogger<ProjectionInbox> logger)
    {
        _processedMessages = database.GetCollection<BsonDocument>("processed_messages");
        _logger = logger;
    }

    public async Task<bool> TryBeginAsync<T>(ConsumeContext<T> context, string consumerName)
        where T : class
    {
        var eventId = GetStableEventId(context);
        var key = $"{consumerName}:{eventId:N}";
        var doc = new BsonDocument
        {
            ["_id"] = key,
            ["consumer"] = consumerName,
            ["eventId"] = eventId.ToString("D"),
            ["messageId"] = context.MessageId.HasValue
                ? new BsonString(context.MessageId.Value.ToString("D"))
                : BsonNull.Value,
            ["status"] = "processing",
            ["processedAt"] = DateTime.UtcNow
        };

        try
        {
            await _processedMessages.InsertOneAsync(doc, cancellationToken: context.CancellationToken);
            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            _logger.LogInformation(
                "Duplicate integration event skipped. Consumer={Consumer} EventId={EventId} MessageId={MessageId}",
                consumerName,
                eventId,
                context.MessageId);
            return false;
        }
    }

    public async Task MarkProcessedAsync<T>(ConsumeContext<T> context, string consumerName)
        where T : class
    {
        var eventId = GetStableEventId(context);
        var key = $"{consumerName}:{eventId:N}";
        await _processedMessages.UpdateOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", key),
            Builders<BsonDocument>.Update
                .Set("status", "processed")
                .Set("completedAt", DateTime.UtcNow),
            cancellationToken: context.CancellationToken);
    }

    public async Task ReleaseAsync<T>(ConsumeContext<T> context, string consumerName)
        where T : class
    {
        var eventId = GetStableEventId(context);
        var key = $"{consumerName}:{eventId:N}";
        await _processedMessages.DeleteOneAsync(
            Builders<BsonDocument>.Filter.Eq("_id", key),
            context.CancellationToken);
    }

    private static Guid GetStableEventId<T>(ConsumeContext<T> context)
        where T : class
    {
        if (context.Message is IIntegrationEvent integrationEvent && integrationEvent.Id != Guid.Empty)
        {
            return integrationEvent.Id;
        }

        var idProperty = context.Message.GetType().GetProperty("Id");
        if (idProperty?.GetValue(context.Message) is Guid contractId && contractId != Guid.Empty)
        {
            return contractId;
        }

        return context.MessageId ?? throw new InvalidOperationException("Integration event has no stable Id or MassTransit MessageId.");
    }
}
