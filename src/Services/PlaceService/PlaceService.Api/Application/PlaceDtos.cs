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
    CurrentPlaceStateDto CurrentState);

public sealed record PlaceDetailDto(
    Guid Id,
    string Name,
    string Category,
    double Latitude,
    double Longitude,
    string? DisplayAddress,
    string Source,
    CurrentPlaceStateDto CurrentState,
    IReadOnlyList<RecentSignalDto> RecentSignals);

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
    IReadOnlyList<RecentSignalMediaDto> Media);

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
