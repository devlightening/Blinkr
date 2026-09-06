namespace PlaceService.Api.Application;

public sealed record DiscoveredPlace(
    string ExternalProvider,
    string ExternalId,
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? DisplayAddress);

public enum PlaceDiscoveryStatus
{
    Success,
    Empty,
    Failure,
    Timeout
}

public sealed record PlaceDiscoveryResult(
    PlaceDiscoveryStatus Status,
    IReadOnlyList<DiscoveredPlace> Places,
    string? Error = null);

public sealed record NearbyPlaceDto(
    Guid Id,
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? DisplayAddress,
    double DistanceMeters,
    CurrentPlaceStateDto CurrentState);

public sealed class PlaceDiscoveryOptions
{
    public bool Enabled { get; set; } = true;
    public string Provider { get; set; } = "osm";
    public string OverpassUrl { get; set; } = "https://overpass-api.de/api/interpreter";
    public int CoverageTtlMinutes { get; set; } = 10080;
    public int MaxViewportPlaces { get; set; } = 80;
    public string UserAgent { get; set; } = "Blinkr beta place discovery";
}
