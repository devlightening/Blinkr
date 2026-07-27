namespace BlogService.Application.DTOs.PostDtos;

/// <summary>
/// Query parameters for loading posts inside the currently visible map area.
/// </summary>
public readonly record struct BoundsQuery(
    double MinLat,
    double MinLon,
    double MaxLat,
    double MaxLon,
    int Zoom = 12,
    int SinceMinutes = 180,
    int Page = 1,
    int PageSize = 100
)
{
    public BoundsQuery Clamp()
    {
        var minLat = Math.Clamp(Math.Min(MinLat, MaxLat), -90, 90);
        var maxLat = Math.Clamp(Math.Max(MinLat, MaxLat), -90, 90);
        var minLon = Math.Clamp(Math.Min(MinLon, MaxLon), -180, 180);
        var maxLon = Math.Clamp(Math.Max(MinLon, MaxLon), -180, 180);

        return new BoundsQuery(
            minLat,
            minLon,
            maxLat,
            maxLon,
            Math.Clamp(Zoom, 1, 22),
            Math.Clamp(SinceMinutes, 0, 10080),
            Math.Max(1, Page),
            Math.Clamp(PageSize, 1, 250));
    }
}
