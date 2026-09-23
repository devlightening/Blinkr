using MassTransit;
using Shared.Events.Events.Blog;
using Shared.Events.Events.Identity;

namespace PlaceService.Api.Infrastructure;

/// <summary>
/// A hidden or removed signal stops counting towards the place's live state and leaves its signal list; restoring it
/// brings it back (sinyal-mvp-plan Faz 10 P10.3/P10.4). The signal is moved between collections, so it is idempotent.
/// </summary>
public sealed class PostModerationPlaceSignalConsumer : IConsumer<PostModerationChangedIntegrationEvent>
{
    private readonly IPlaceRepository _repository;
    private readonly ILogger<PostModerationPlaceSignalConsumer> _logger;

    public PostModerationPlaceSignalConsumer(IPlaceRepository repository, ILogger<PostModerationPlaceSignalConsumer> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PostModerationChangedIntegrationEvent> context)
    {
        var message = context.Message;
        var hidden = message.State != PostModerationChangedIntegrationEvent.Visible;
        var moved = await _repository.SetSignalModeratedAsync(message.PostId, hidden, context.CancellationToken);
        if (moved) _logger.LogInformation("Place signal {PostId} moderation state: {State}", message.PostId, message.State);
    }
}

/// <summary>A deleted signal no longer counts towards the place's live state (it used to stay until it expired).</summary>
public sealed class PostDeletedPlaceSignalConsumer : IConsumer<PostDeletedIntegrationEvent>
{
    private readonly IPlaceRepository _repository;

    public PostDeletedPlaceSignalConsumer(IPlaceRepository repository) => _repository = repository;

    public Task Consume(ConsumeContext<PostDeletedIntegrationEvent> context) =>
        _repository.DeleteSignalAsync(context.Message.PostId, context.CancellationToken);
}
