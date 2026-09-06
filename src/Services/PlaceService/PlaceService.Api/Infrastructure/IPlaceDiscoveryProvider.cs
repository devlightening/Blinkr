using PlaceService.Api.Application;

namespace PlaceService.Api.Infrastructure;

public interface IPlaceDiscoveryProvider
{
    string Name { get; }
    Task<PlaceDiscoveryResult> DiscoverAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct);
}
