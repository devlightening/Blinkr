using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace BlogService.Application.Services;

public interface IPlaceProximityPolicy
{
    PlaceProximityDecision Evaluate(PlaceProximityRequest request);
}

public sealed class PlaceProximityOptions
{
    public int MaxRealtimePlaceDistanceMeters { get; set; } = 200;
    public int MaxAcceptedAccuracyMeters { get; set; } = 150;
    public int MaxAccuracyAllowanceMeters { get; set; } = 50;
    public int MaxNearbyPlaceDistanceMeters { get; set; } = 600;
}

public sealed record PlaceProximityRequest(
    string SignalType,
    double PlaceLatitude,
    double PlaceLongitude,
    double? ObservationLatitude,
    double? ObservationLongitude,
    double? ObservationAccuracyMeters,
    string? GeometryWkt = null);

public sealed record PlaceProximityDecision(bool IsRealtime, bool IsAllowed, double? DistanceMeters, double? EffectiveDistanceMeters)
{
    public string TrustLevel { get; init; } = "UNVERIFIED";
}

public sealed class PlaceProximityException : Exception
{
    public PlaceProximityException(string message) : base(message)
    {
    }
}

public sealed class PlaceProximityPolicy : IPlaceProximityPolicy
{
    private readonly PlaceProximityOptions _options;

    public PlaceProximityPolicy(IOptions<PlaceProximityOptions> options)
    {
        _options = options.Value;
    }

    public PlaceProximityDecision Evaluate(PlaceProximityRequest request)
    {
        var isRealtime = IsRealtimeSignal(request.SignalType);

        if (!request.ObservationLatitude.HasValue || !request.ObservationLongitude.HasValue)
        {
            return new PlaceProximityDecision(true, false, null, null);
        }

        if (!IsValidCoordinate(request.ObservationLatitude.Value, request.ObservationLongitude.Value))
        {
            return new PlaceProximityDecision(true, false, null, null);
        }

        if (request.ObservationAccuracyMeters is not double reportedAccuracy
            || !double.IsFinite(reportedAccuracy) || reportedAccuracy < 0
            || reportedAccuracy > Math.Min(150, _options.MaxAcceptedAccuracyMeters))
            return new PlaceProximityDecision(isRealtime, false, null, null);

        var accuracy = Math.Min(reportedAccuracy, Math.Clamp(_options.MaxAccuracyAllowanceMeters, 0, 50));
        var distance = DistanceMeters(
            request.PlaceLatitude,
            request.PlaceLongitude,
            request.ObservationLatitude.Value,
            request.ObservationLongitude.Value);
        distance = GeometryDistance(request, distance);
        var effectiveDistance = Math.Max(0, distance - accuracy);
        var verified = effectiveDistance <= Math.Max(1, _options.MaxRealtimePlaceDistanceMeters);
        var allowed = effectiveDistance <= _options.MaxNearbyPlaceDistanceMeters;
        return new PlaceProximityDecision(
            isRealtime,
            allowed,
            distance,
            effectiveDistance)
        {
            TrustLevel = verified ? "VERIFIED_LIVE" : allowed ? "NEARBY_PLACE_POST" : "OUT_OF_RANGE"
        };
    }

    private static double GeometryDistance(PlaceProximityRequest request, double fallback)
    {
        if (string.IsNullOrWhiteSpace(request.GeometryWkt)) return fallback;
        try
        {
            var geometry = new WKTReader().Read(request.GeometryWkt);
            if (geometry is not Polygon && geometry is not MultiPolygon) return fallback;
            if (geometry.IsEmpty || !geometry.IsValid
                || geometry.Coordinates.Any(c => !IsValidCoordinate(c.Y, c.X))) return fallback;
            // Local metric projection: NTS distances are planar, never degrees-as-metres.
            geometry.Apply(new LocalMetricFilter(request.ObservationLatitude!.Value, request.ObservationLongitude!.Value));
            geometry.GeometryChanged();
            return geometry.Distance(new Point(0, 0));
        }
        catch (ArgumentException) { return fallback; }
        catch (ParseException) { return fallback; }
    }

    private sealed class LocalMetricFilter(double latitude, double longitude) : ICoordinateFilter
    {
        public void Filter(Coordinate coordinate)
        {
            coordinate.X = DegreesToRadians(coordinate.X - longitude) * 6371000 * Math.Cos(DegreesToRadians(latitude));
            coordinate.Y = DegreesToRadians(coordinate.Y - latitude) * 6371000;
        }
    }

    private static bool IsRealtimeSignal(string signalType) =>
        signalType is "GeneralObservation" or "Crowd" or "Queue" or "TemporaryStatus" or "Offer";

    private static bool IsValidCoordinate(double lat, double lon) =>
        lat is >= -90 and <= 90 && lon is >= -180 and <= 180;

    private static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double earthRadius = 6371000;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return earthRadius * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180;
}
