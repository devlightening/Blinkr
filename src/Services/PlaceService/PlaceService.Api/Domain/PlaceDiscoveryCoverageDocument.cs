using MongoDB.Bson.Serialization.Attributes;

namespace PlaceService.Api.Domain;

public sealed class PlaceDiscoveryCoverageDocument
{
    [BsonId]
    public string Key { get; set; } = string.Empty;
    public DateTime RefreshedAtUtc { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Status { get; set; } = "success";
    public int Count { get; set; }
}
