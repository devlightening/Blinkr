namespace BlogService.Application.Features.Mediatr.Comamnds.PostLocationCommands;

/// <summary>
/// Privacy utility for location coordinate quantization
/// </summary>
public static class GeoPrivacy
{
    /// <summary>
    /// Apply privacy coarsening to coordinates based on precision mode
    /// </summary>
    /// <param name="lat">Original latitude</param>
    /// <param name="lon">Original longitude</param>
    /// <param name="precision">Precision mode</param>
    /// <returns>Adjusted coordinates (precise or ~1.2km grid)</returns>
    public static (double lat, double lon) Coarse(double lat, double lon, LocationPrecision precision)
    {
        if (precision == LocationPrecision.Precise) 
            return (lat, lon);

        // Approximate mode: snap to ~1.2km grid for privacy
        // 1.2km in degrees (approximate)
        var latDeg = 1200.0 / 111_320.0; // ~0.0108 degrees
        var lonDeg = 1200.0 / (111_320.0 * Math.Cos(Math.Clamp(lat * Math.PI / 180.0, -1.5533, 1.5533))); // Adjust for latitude

        static double RoundTo(double value, double step) => 
            Math.Round(value / step, MidpointRounding.AwayFromZero) * step;

        return (RoundTo(lat, latDeg), RoundTo(lon, lonDeg));
    }
}
