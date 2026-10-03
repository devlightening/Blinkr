using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace PlaceService.Api.Domain;

/// <summary>
/// One person's answer about one fact of a place (D-040, "Yer özellikleri"): Wi-Fi, outlets, quiet... A person has one
/// vote per place and fact; confirming again refreshes it. Voters are never shown, only how many and how recently.
/// </summary>
public sealed class PlaceAttributeVoteDocument
{
    /// <summary>The fixed catalog. Facts a person decides on before going; nothing subjective like "tasty".</summary>
    public static readonly IReadOnlyList<string> Keys = new[] { "wifi", "outlets", "quiet", "kid_friendly", "accessible", "outdoor", "pet_friendly" };

    [BsonId]
    public ObjectId Id { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid PlaceId { get; set; }

    public string Key { get; set; } = string.Empty;

    /// <summary>Server-side only.</summary>
    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }

    public bool Value { get; set; }

    public DateTime VotedAtUtc { get; set; }
}
