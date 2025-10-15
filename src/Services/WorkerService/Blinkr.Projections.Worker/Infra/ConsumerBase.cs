using MassTransit;
using MongoDB.Driver;

namespace Blinkr.Projections.Worker.Infra;

public abstract class ConsumerBase<T> : IConsumer<T> where T : class
{
    private readonly IMongoCollection<ProcessedMessage> _processed;
    protected readonly ILogger Logger;

    protected ConsumerBase(IMongoDatabase db, ILogger logger)
    {
        _processed = db.GetCollection<ProcessedMessage>("__processed");
        Logger = logger;
    }

    public async Task Consume(ConsumeContext<T> context)
    {
        var messageId = context.MessageId!.Value;
        try
        {
            await _processed.InsertOneAsync(new ProcessedMessage { Id = messageId });
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            Logger.LogWarning("Duplicate message {Id}", messageId);
            return;
        }

        await Process(context);
    }

    protected abstract Task Process(ConsumeContext<T> context);
}

public class ProcessedMessage
{
    public Guid Id { get; set; }
}
