using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver.GeoJsonObjectModel;

namespace PlaceService.Api.Domain;

/// <summary>
/// "Yere sor" (D-039): people asking how a place is right now. Structured only (no free text, so nothing to moderate and
/// no channel for harassment), one open question per place and kind - a second asker joins it - and answered by a normal
/// signal that the server published as VERIFIED_LIVE. Askers are never shown to anyone; answerers only see how many wait.
/// </summary>
public sealed class PlaceQuestionDocument
{
    public const string Crowd = "crowd";
    public const string Queue = "queue";
    public const string Open = "open";

    public const string StatusOpen = "open";
    public const string StatusAnswered = "answered";

    /// <summary>A question is worth an hour; after that a fresh one should be asked.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(60);
    /// <summary>Open questions one person may have at a time (across places).</summary>
    public const int MaxOpenPerAsker = 3;

    public static readonly IReadOnlyDictionary<string, string> SignalTypeOf = new Dictionary<string, string>
    {
        [Crowd] = "Crowd",
        [Queue] = "Queue",
        [Open] = "TemporaryStatus",
    };

    /// <summary>The question kind a signal type answers, or null.</summary>
    public static string? KindFor(string signalType) => signalType switch
    {
        "Crowd" => Crowd,
        "Queue" => Queue,
        "TemporaryStatus" => Open,
        _ => null,
    };

    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid PlaceId { get; set; }

    public string PlaceName { get; set; } = string.Empty;
    public string? PlaceCategory { get; set; }

    /// <summary>The place's own position (public catalog data), for "questions near me". Never an asker's position.</summary>
    public GeoJsonPoint<GeoJson2DGeographicCoordinates> Location { get; set; } = null!;

    public string Kind { get; set; } = Crowd;

    /// <summary>Server-side only: who to tell when it is answered. Never returned by the API.</summary>
    [BsonRepresentation(BsonType.String)]
    public List<Guid> AskerIds { get; set; } = new();

    public string Status { get; set; } = StatusOpen;
    public DateTime CreatedAtUtc { get; set; }
    /// <summary>A TTL index removes the question after this time, answered or not.</summary>
    public DateTime ExpiresAtUtc { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid? AnsweredByPostId { get; set; }
    public string? AnswerValue { get; set; }
    public DateTime? AnsweredAtUtc { get; set; }
}
