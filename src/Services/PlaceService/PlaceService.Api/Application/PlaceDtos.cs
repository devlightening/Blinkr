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
    DateTime? LastActivityUtc = null);

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
    string? GeometryWkt = null);

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
