namespace Blinkr.Mobile.Features.Map;

public sealed record MapMarker(
    Guid Id,
    string Title,
    double Lat,
    double Lng,
    string? Address = null,
    string? Gender = null
);
