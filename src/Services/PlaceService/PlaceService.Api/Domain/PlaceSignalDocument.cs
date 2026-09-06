using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace PlaceService.Api.Domain;

public sealed class PlaceSignalDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid PostId { get; set; }
    [BsonRepresentation(BsonType.String)]
    public Guid PlaceId { get; set; }
    public string? Title { get; set; }
    public string? Text { get; set; }
    public string SignalType { get; set; } = "GeneralObservation";
    public string? SignalValue { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public string? LocationName { get; set; }
    public IReadOnlyList<SignalMediaDto> Media { get; set; } = Array.Empty<SignalMediaDto>();
}

public sealed record SignalMediaDto(
    string? Url,
    string? MediaType,
    [property: BsonRepresentation(BsonType.String)]
    Guid? MediaId = null,
    string? ContentType = null,
    long? SizeBytes = null,
    int? Width = null,
    int? Height = null,
    double? DurationSeconds = null,
    string? ThumbnailUrl = null);
