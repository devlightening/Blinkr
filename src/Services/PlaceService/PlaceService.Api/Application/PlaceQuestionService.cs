using PlaceService.Api.Domain;
using PlaceService.Api.Infrastructure;

namespace PlaceService.Api.Application;

/// <summary>What anyone may see about a question: never who asked, only how many wait (D-039).</summary>
public sealed record PlaceQuestionDto(
    Guid Id,
    Guid PlaceId,
    string PlaceName,
    string? PlaceCategory,
    double Latitude,
    double Longitude,
    string Kind,
    int Waiting,
    bool AskedByMe,
    string Status,
    DateTime CreatedAtUtc,
    DateTime ExpiresAtUtc,
    string? AnswerValue,
    DateTime? AnsweredAtUtc,
    Guid? AnswerPostId);

public sealed class PlaceQuestionException : Exception
{
    public const string InvalidCode = "QUESTION_INVALID";
    public const string LimitCode = "QUESTION_LIMIT";
    public const string NotFoundCode = "PLACE_NOT_FOUND";

    public string Code { get; }
    public PlaceQuestionException(string code, string message) : base(message) => Code = code;
}

/// <summary>
/// "Yere sor" (D-039) use cases: ask, withdraw, read, and answer from a verified signal. Answering needs no endpoint of
/// its own: a normal signal the server published as VERIFIED_LIVE (on site, CLAUDE.md §10.1) answers the open question
/// of its kind, so the proximity rule stays in one place (BlogService's PlaceProximityPolicy).
/// </summary>
public sealed class PlaceQuestionService
{
    private readonly IPlaceRepository _places;
    private readonly IPlaceQuestionRepository _questions;

    public PlaceQuestionService(IPlaceRepository places, IPlaceQuestionRepository questions)
    {
        _places = places;
        _questions = questions;
    }

    public async Task<PlaceQuestionDto> AskAsync(Guid placeId, string? kind, Guid askerId, CancellationToken ct)
    {
        var normalized = kind?.Trim().ToLowerInvariant() ?? string.Empty;
        if (askerId == Guid.Empty || !PlaceQuestionDocument.SignalTypeOf.ContainsKey(normalized))
            throw new PlaceQuestionException(PlaceQuestionException.InvalidCode, "Bu soru sorulamaz.");
        var place = await _places.GetAsync(placeId, ct) ?? throw new PlaceQuestionException(PlaceQuestionException.NotFoundCode, "Yer bulunamadı.");

        var now = DateTime.UtcNow;
        var mine = await _questions.ListForPlaceAsync(placeId, now, ct);
        var alreadyAsking = mine.Any(q => q.Kind == normalized && q.Status == PlaceQuestionDocument.StatusOpen && q.AskerIds.Contains(askerId));
        if (!alreadyAsking && await _questions.CountOpenForAskerAsync(askerId, now, ct) >= PlaceQuestionDocument.MaxOpenPerAsker)
            throw new PlaceQuestionException(PlaceQuestionException.LimitCode, $"Aynı anda en fazla {PlaceQuestionDocument.MaxOpenPerAsker} soru sorabilirsin.");

        return ToDto(await _questions.AskAsync(place, normalized, askerId, now, ct), askerId);
    }

    public Task WithdrawAsync(Guid placeId, string? kind, Guid askerId, CancellationToken ct) =>
        _questions.WithdrawAsync(placeId, kind?.Trim().ToLowerInvariant() ?? string.Empty, askerId, DateTime.UtcNow, ct);

    public async Task<IReadOnlyList<PlaceQuestionDto>> ForPlaceAsync(Guid placeId, Guid? viewerId, CancellationToken ct) =>
        (await _questions.ListForPlaceAsync(placeId, DateTime.UtcNow, ct)).Select(q => ToDto(q, viewerId)).ToList();

    public async Task<IReadOnlyList<PlaceQuestionDto>> NearAsync(double lat, double lon, int radiusMeters, Guid? viewerId, CancellationToken ct) =>
        (await _questions.ListOpenNearAsync(lat, lon, Math.Clamp(radiusMeters, 100, 3000), 20, DateTime.UtcNow, ct)).Select(q => ToDto(q, viewerId)).ToList();

    /// <summary>
    /// A new signal answers the open question of its kind when the server verified it on site. Returns the answered
    /// question (also when this same post answered it before: a redelivered event then publishes again), or null.
    /// </summary>
    public Task<PlaceQuestionDocument?> AnswerFromSignalAsync(Guid placeId, Guid postId, string signalType, string? signalValue, string? publicationTrust, CancellationToken ct)
    {
        var kind = PlaceQuestionDocument.KindFor(signalType);
        if (publicationTrust != "VERIFIED_LIVE" || kind is null || string.IsNullOrWhiteSpace(signalValue)) return Task.FromResult<PlaceQuestionDocument?>(null);
        return _questions.TryAnswerAsync(placeId, kind, postId, signalValue, DateTime.UtcNow, ct);
    }

    private static PlaceQuestionDto ToDto(PlaceQuestionDocument q, Guid? viewerId) => new(
        q.Id, q.PlaceId, q.PlaceName, q.PlaceCategory,
        q.Location.Coordinates.Latitude, q.Location.Coordinates.Longitude,
        q.Kind, q.AskerIds.Count, viewerId.HasValue && q.AskerIds.Contains(viewerId.Value),
        q.Status, q.CreatedAtUtc, q.ExpiresAtUtc, q.AnswerValue, q.AnsweredAtUtc, q.AnsweredByPostId);
}
