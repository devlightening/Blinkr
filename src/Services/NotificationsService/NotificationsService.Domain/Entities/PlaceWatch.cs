using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NotificationsService.Domain.Entities;

/// <summary>
/// "Haber ver" (D-038): one person waiting for one place to reach a state - quiet, open, or any new verified update.
/// A decision tool, not an engagement hook: it fires once and is gone, and it expires on its own after
/// <see cref="Lifetime"/>. Nobody else ever learns who watches which place.
/// </summary>
public class PlaceWatch
{
    public const int MaxActive = 5;
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(12);

    /// <summary>Quiet: Doluluk "Sakin" or Bekleme "Sıra yok".</summary>
    public const string Calm = "calm";
    /// <summary>Open again: Geçici durum "Açık".</summary>
    public const string Open = "open";
    /// <summary>Any change of the live state.</summary>
    public const string Update = "update";

    public static readonly IReadOnlySet<string> Conditions = new HashSet<string>(StringComparer.Ordinal) { Calm, Open, Update };

    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid PlaceId { get; set; }

    /// <summary>For the notification text and the watcher's own list; never shown to anyone else.</summary>
    public string PlaceName { get; set; } = string.Empty;

    public string Condition { get; set; } = Calm;

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>A TTL index removes the row after this time.</summary>
    public DateTime ExpiresAtUtc { get; set; }

    public static PlaceWatch Create(Guid userId, Guid placeId, string placeName, string condition, DateTime nowUtc)
    {
        if (!Conditions.Contains(condition)) throw new ArgumentOutOfRangeException(nameof(condition));
        var name = placeName.Trim();
        return new PlaceWatch
        {
            UserId = userId,
            PlaceId = placeId,
            PlaceName = name.Length > 120 ? name[..120] : name,
            Condition = condition,
            CreatedAtUtc = nowUtc,
            ExpiresAtUtc = nowUtc + Lifetime,
        };
    }

    /// <summary>Whether a new live state is what this person is waiting for.</summary>
    public static bool Matches(string condition, string? signalType, string? signalValue) => condition switch
    {
        Calm => (signalType, signalValue) is ("Crowd", "Calm") or ("Queue", "None"),
        Open => (signalType, signalValue) is ("TemporaryStatus", "Open"),
        Update => signalType is not null,
        _ => false,
    };
}
