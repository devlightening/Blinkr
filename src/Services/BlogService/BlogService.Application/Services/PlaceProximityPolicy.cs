using Microsoft.Extensions.Options;

namespace BlogService.Application.Services;

public interface IPlaceProximityPolicy
{
    PlaceProximityDecision Evaluate(PlaceProximityRequest request);
}

public sealed class PlaceProximityOptions
{
    public int MaxRealtimePlaceDistanceMeters { get; set; } = 200;
    public int MaxAcceptedAccuracyMeters { get; set; } = 500;
}

public sealed record PlaceProximityRequest(
    string SignalType,
    double PlaceLatitude,
    double PlaceLongitude,
    double? ObservationLatitude,
    double? ObservationLongitude,
    double? ObservationAccuracyMeters);

public sealed record PlaceProximityDecision(bool IsRealtime, bool IsAllowed, double? DistanceMeters, double? EffectiveDistanceMeters);

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
        if (!isRealtime) return new PlaceProximityDecision(false, true, null, null);

        if (!request.ObservationLatitude.HasValue || !request.ObservationLongitude.HasValue)
        {
            return new PlaceProximityDecision(true, false, null, null);
        }

        if (!IsValidCoordinate(request.ObservationLatitude.Value, request.ObservationLongitude.Value))
        {
            return new PlaceProximityDecision(true, false, null, null);
        }

        var accuracy = Math.Clamp(request.ObservationAccuracyMeters ?? 0, 0, _options.MaxAcceptedAccuracyMeters);
        var distance = DistanceMeters(
            request.PlaceLatitude,
            request.PlaceLongitude,
            request.ObservationLatitude.Value,
            request.ObservationLongitude.Value);
        var effectiveDistance = Math.Max(0, distance - accuracy);
        return new PlaceProximityDecision(
            true,
            effectiveDistance <= Math.Max(1, _options.MaxRealtimePlaceDistanceMeters),
            distance,
            effectiveDistance);
    }

    private static bool IsRealtimeSignal(string signalType) =>
        signalType is "GeneralObservation" or "Crowd" or "Queue" or "TemporaryStatus";

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
