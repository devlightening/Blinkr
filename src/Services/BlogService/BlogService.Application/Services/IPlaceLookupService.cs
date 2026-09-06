namespace BlogService.Application.Services;

public interface IPlaceLookupService
{
    Task<bool> ExistsAsync(Guid placeId, CancellationToken ct);
    Task<PlaceLookupResult?> GetAsync(Guid placeId, CancellationToken ct);
}

public sealed record PlaceLookupResult(Guid Id, string Name, double Latitude, double Longitude);
