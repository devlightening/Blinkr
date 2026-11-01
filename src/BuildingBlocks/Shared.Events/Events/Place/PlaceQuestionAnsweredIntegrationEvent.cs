using Shared.Events.Concretes;

namespace Shared.Events.Events.Place;

/// <summary>
/// "Yere sor" (D-039): a question about a place was answered by a server-verified (VERIFIED_LIVE) signal. Published by
/// PlaceService once per question (the first answer wins); NotificationsService tells everyone who asked.
/// <see cref="AskerIds"/> and <see cref="AnsweredByAuthorId"/> are internal to the bus and never reach a client: askers stay
/// anonymous to the answerer and the notice does not name who answered. The event id is derived from the question and the
/// answering post, so a redelivery keeps its identity.
/// </summary>
public sealed class PlaceQuestionAnsweredIntegrationEvent : IntegrationEvent
{
    public Guid QuestionId { get; init; }
    public Guid PlaceId { get; init; }
    public string PlaceName { get; init; } = string.Empty;
    /// <summary>crowd | queue | open</summary>
    public string Kind { get; init; } = string.Empty;
    public IReadOnlyList<Guid> AskerIds { get; init; } = Array.Empty<Guid>();
    public Guid AnswerPostId { get; init; }
    public string? AnswerSignalType { get; init; }
    public string? AnswerValue { get; init; }
    public Guid? AnsweredByAuthorId { get; init; }
    public DateTime AnsweredAtUtc { get; init; }
}
