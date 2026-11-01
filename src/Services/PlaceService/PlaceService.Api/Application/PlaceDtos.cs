namespace PlaceService.Api.Application;

public sealed record CreatePlaceRequest(
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? DisplayAddress,
    string? Source);

public sealed record PlaceSummaryDto(
    Guid Id,
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? DisplayAddress,
    CurrentPlaceStateDto CurrentState,
    int ActivityCount = 0,
    DateTime? LastActivityUtc = null,
    OpeningHoursDto? OpeningHours = null);

public sealed record PlaceDetailDto(
    Guid Id,
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? DisplayAddress,
    string Source,
    CurrentPlaceStateDto CurrentState,
    IReadOnlyList<RecentSignalDto> RecentSignals,
    string? GeometryWkt = null,
    OpeningHoursDto? OpeningHours = null);

/// <summary>
/// A conservative server-side interpretation of the catalogue's opening_hours value. Null IsOpenNow means that the
/// raw value was preserved but was too complex to interpret safely; clients must not present an open/closed estimate.
/// </summary>
public sealed record OpeningHoursDto(
    string Raw,
    bool? IsOpenNow,
    DateTime? NextOpenAtUtc,
    DateTime? NextCloseAtUtc,
    string TimeZoneId,
    string? NextOpenLocalTime = null);

public sealed record CurrentPlaceStateDto(
    string? SignalType,
    string? SignalValue,
    string Freshness,
    DateTime? ObservedAtUtc,
    DateTime? ExpiresAtUtc,
    string Confidence,
    double ConfidenceValue,
    int ActiveSignalCount);

public sealed record RecentSignalDto(
    Guid PostId,
    string? Title,
    string? Text,
    string SignalType,
    string? SignalValue,
    DateTime CreatedAtUtc,
    DateTime? ExpiresAtUtc,
    string? LocationName,
    IReadOnlyList<RecentSignalMediaDto> Media,
    string? PublicationTrust = null,
    string? AuthorName = null);

public sealed record RecentSignalMediaDto(
    string? Url,
    string? MediaType,
    Guid? MediaId = null,
    string? ContentType = null,
    long? SizeBytes = null,
    int? Width = null,
    int? Height = null,
    double? DurationSeconds = null,
    string? ThumbnailUrl = null);
