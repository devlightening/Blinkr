using System.Security.Cryptography;
using System.Text;
using MassTransit;
using PlaceService.Api.Application;
using PlaceService.Api.Domain;
using Shared.Events.Abstractions;
using Shared.Events.Events.Place;

namespace PlaceService.Api.Infrastructure;

public sealed class PostCreatedPlaceSignalConsumer : IConsumer<IPostCreatedIntegrationEvent>
{
    /// <summary>Only states someone would wait for (D-038): how busy, how long the line, open or closed.</summary>
    private static readonly HashSet<string> WatchableTypes = new(StringComparer.Ordinal) { "Crowd", "Queue", "TemporaryStatus" };

    private readonly IPlaceRepository _repository;
    private readonly PlaceStateChangeDetector _changes;
    private readonly PlaceQuestionService _questions;
    private readonly ILogger<PostCreatedPlaceSignalConsumer> _logger;

    public PostCreatedPlaceSignalConsumer(IPlaceRepository repository, PlaceStateChangeDetector changes, PlaceQuestionService questions, ILogger<PostCreatedPlaceSignalConsumer> logger)
    {
        _repository = repository;
        _changes = changes;
        _questions = questions;
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

        var signalType = string.IsNullOrWhiteSpace(message.SignalType) ? "GeneralObservation" : message.SignalType;
        await _repository.UpsertSignalAsync(new PlaceSignalDocument
        {
            PostId = message.PostId,
            PlaceId = message.PlaceId.Value,
            Title = message.Title,
            Text = message.Content,
            SignalType = signalType,
            SignalValue = message.SignalValue,
            PublicationTrust = message.PublicationTrust,
            AuthorName = message.IdentityDisclosure == "AnonymousMap" ? null : message.AuthorName,
            AuthorId = message.AuthorId == Guid.Empty ? null : message.AuthorId,
            CreatedAtUtc = message.OccurredOn,
            ExpiresAtUtc = message.ExpiresAt,
            LocationName = message.LocationName,
            Media = message.Media?.Select(m => new SignalMediaDto(m.Url, m.MediaType, m.MediaId, m.ContentType, m.SizeBytes, m.Width, m.Height, m.DurationSeconds, m.ThumbnailUrl)).ToArray() ?? Array.Empty<SignalMediaDto>()
        }, context.CancellationToken);

        // Two independent follow-ups, each published after the upsert so a redelivery repeats them with the same ids.
        await PublishStateChangeAsync(context, place, signalType);
        await PublishQuestionAnswerAsync(context, place, signalType);
    }

    /// <summary>D-038 "Haber ver": only a verified signal of a watchable kind can change what watchers wait for.</summary>
    private async Task PublishStateChangeAsync(ConsumeContext<IPostCreatedIntegrationEvent> context, PlaceDocument place, string signalType)
    {
        var message = context.Message;
        if (message.PublicationTrust != "VERIFIED_LIVE" || !WatchableTypes.Contains(signalType)) return;

        var active = await _repository.GetSignalsAsync(place.Id, 20, context.CancellationToken);
        var changed = _changes.Detect(active, message.PostId, DateTime.UtcNow);
        if (changed is null) return;

        // Published after the upsert: a redelivery re-upserts (idempotent) and republishes with the same event id.
        await context.Publish(new PlaceLiveStateChangedIntegrationEvent
        {
            Id = StableId($"place-live-state:{message.PostId:N}"),
            PlaceId = place.Id,
            PlaceName = place.Name,
            SignalType = changed.SignalType,
            SignalValue = changed.SignalValue,
            CausedByPostId = message.PostId,
            CausedByAuthorId = message.AuthorId == Guid.Empty ? null : message.AuthorId,
            ObservedAtUtc = message.OccurredOn,
        }, context.CancellationToken);
        _logger.LogInformation("Place live state changed | PlaceId={PlaceId} | PostId={PostId} | SignalType={SignalType}", place.Id, message.PostId, changed.SignalType);
    }

    /// <summary>D-039 "Yere sor": a verified signal answers the open question of its kind; everyone who asked is told.</summary>
    private async Task PublishQuestionAnswerAsync(ConsumeContext<IPostCreatedIntegrationEvent> context, PlaceDocument place, string signalType)
    {
        var message = context.Message;
        var question = await _questions.AnswerFromSignalAsync(place.Id, message.PostId, signalType, message.SignalValue, message.PublicationTrust, context.CancellationToken);
        if (question is null || question.AnsweredByPostId != message.PostId) return;

        await context.Publish(new PlaceQuestionAnsweredIntegrationEvent
        {
            Id = StableId($"place-question:{question.Id:N}:{message.PostId:N}"),
            QuestionId = question.Id,
            PlaceId = place.Id,
            PlaceName = place.Name,
            Kind = question.Kind,
            AskerIds = question.AskerIds.ToArray(),
            AnswerPostId = message.PostId,
            AnswerSignalType = signalType,
            AnswerValue = message.SignalValue,
            AnsweredByAuthorId = message.AuthorId == Guid.Empty ? null : message.AuthorId,
            AnsweredAtUtc = question.AnsweredAtUtc ?? message.OccurredOn,
        }, context.CancellationToken);
        _logger.LogInformation("Place question answered | PlaceId={PlaceId} | QuestionId={QuestionId} | PostId={PostId} | Askers={Askers}", place.Id, question.Id, message.PostId, question.AskerIds.Count);
    }

    /// <summary>The same input always yields the same event id, so consumers can recognise a repeat.</summary>
    private static Guid StableId(string key) => new(MD5.HashData(Encoding.UTF8.GetBytes(key)));
}
