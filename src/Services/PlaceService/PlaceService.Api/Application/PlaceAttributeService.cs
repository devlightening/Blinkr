using PlaceService.Api.Domain;
using PlaceService.Api.Infrastructure;

namespace PlaceService.Api.Application;

public sealed class PlaceAttributeException : Exception
{
    public const string InvalidCode = "ATTRIBUTE_INVALID";
    public const string NotEligibleCode = "ATTRIBUTE_NOT_ELIGIBLE";
    public const string TooManyCode = "TOO_MANY_VOTES";
    public const string NotFoundCode = "PLACE_NOT_FOUND";

    public string Code { get; }
    public PlaceAttributeException(string code, string message) : base(message) => Code = code;
}

/// <summary>
/// "Yer özellikleri" (D-040) use cases. Only someone the server verified at the place recently may answer: trust is
/// server-owned (CLAUDE.md §2.1), so eligibility is read from the place's own verified signals, never claimed by the app.
/// </summary>
public sealed class PlaceAttributeService
{
    /// <summary>How recent the verified visit must be.</summary>
    public static readonly TimeSpan VisitWindow = TimeSpan.FromDays(30);
    /// <summary>A plain abuse brake: votes per person per day.</summary>
    public const int MaxVotesPerDay = 50;

    private readonly IPlaceRepository _places;
    private readonly IPlaceAttributeRepository _votes;
    private readonly PlaceAttributeCalculator _calculator;

    public PlaceAttributeService(IPlaceRepository places, IPlaceAttributeRepository votes, PlaceAttributeCalculator calculator)
    {
        _places = places;
        _votes = votes;
        _calculator = calculator;
    }

    public async Task<PlaceAttributesResponse> GetAsync(Guid placeId, Guid? viewerId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var votes = await _votes.ListForPlaceAsync(placeId, now - PlaceAttributeCalculator.ForgottenAfter, ct);
        var canVote = viewerId.HasValue && await _votes.HasVerifiedSignalAsync(placeId, viewerId.Value, now - VisitWindow, ct);
        return new PlaceAttributesResponse(_calculator.Calculate(votes, viewerId, now), canVote, PlaceAttributeVoteDocument.Keys);
    }

    /// <summary>Sets (true/false) or takes back (null) my answer for one fact.</summary>
    public async Task<PlaceAttributesResponse> VoteAsync(Guid placeId, string key, bool? value, Guid userId, CancellationToken ct)
    {
        var normalized = key.Trim().ToLowerInvariant();
        if (!PlaceAttributeVoteDocument.Keys.Contains(normalized))
            throw new PlaceAttributeException(PlaceAttributeException.InvalidCode, "Bu özellik yok.");
        if (await _places.GetAsync(placeId, ct) is null)
            throw new PlaceAttributeException(PlaceAttributeException.NotFoundCode, "Yer bulunamadı.");

        var now = DateTime.UtcNow;
        if (value is null)
        {
            await _votes.RemoveAsync(placeId, normalized, userId, ct);
            return await GetAsync(placeId, userId, ct);
        }
        if (!await _votes.HasVerifiedSignalAsync(placeId, userId, now - VisitWindow, ct))
            throw new PlaceAttributeException(PlaceAttributeException.NotEligibleCode, "Bu yer hakkında bilgi vermek için son 30 günde burada konumda doğrulanmış bir sinyalin olmalı.");
        if (await _votes.CountVotesSinceAsync(userId, now.AddDays(-1), ct) >= MaxVotesPerDay)
            throw new PlaceAttributeException(PlaceAttributeException.TooManyCode, "Bugün yeterince katkı verdin, yarın tekrar dene.");

        await _votes.SetAsync(placeId, normalized, userId, value.Value, now, ct);
        return await GetAsync(placeId, userId, ct);
    }
}
