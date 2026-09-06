using MassTransit;
using PlaceService.Api.Domain;
using Shared.Events.Abstractions;

namespace PlaceService.Api.Infrastructure;

public sealed class PostCreatedPlaceSignalConsumer : IConsumer<IPostCreatedIntegrationEvent>
{
    private readonly IPlaceRepository _repository;
    private readonly ILogger<PostCreatedPlaceSignalConsumer> _logger;

    public PostCreatedPlaceSignalConsumer(IPlaceRepository repository, ILogger<PostCreatedPlaceSignalConsumer> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<IPostCreatedIntegrationEvent> context)
    {
        var message = context.Message;
        if (!message.PlaceId.HasValue)
            return;

        var place = await _repository.GetAsync(message.PlaceId.Value, context.CancellationToken);
        if (place is null)
        {
            _logger.LogWarning("Ignoring signal {PostId}; place {PlaceId} was not found", message.PostId, message.PlaceId);
            return;
        }

        await _repository.UpsertSignalAsync(new PlaceSignalDocument
        {
            PostId = message.PostId,
            PlaceId = message.PlaceId.Value,
            Title = message.Title,
            Text = message.Content,
            SignalType = string.IsNullOrWhiteSpace(message.SignalType) ? "GeneralObservation" : message.SignalType,
            SignalValue = message.SignalValue,
            CreatedAtUtc = message.OccurredOn,
            ExpiresAtUtc = message.ExpiresAt,
            LocationName = message.LocationName,
            Media = message.Media?.Select(m => new SignalMediaDto(m.Url, m.MediaType, m.MediaId, m.ContentType, m.SizeBytes, m.Width, m.Height, m.DurationSeconds, m.ThumbnailUrl)).ToArray() ?? Array.Empty<SignalMediaDto>()
        }, context.CancellationToken);
    }
}
