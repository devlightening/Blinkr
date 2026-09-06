using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using PlaceService.Api.Application;
using PlaceService.Api.Domain;

namespace PlaceService.Api.Infrastructure;

public interface IPlaceRepository
{
    Task<PlaceDocument?> GetAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<PlaceDocument>> GetNearbyAsync(double lat, double lon, int radiusMeters, int limit, CancellationToken ct);
    Task<IReadOnlyList<PlaceDocument>> GetBoundsAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct);
    Task<PlaceDocument> CreateAsync(CreatePlaceRequest request, CancellationToken ct);
    Task<IReadOnlyList<PlaceDocument>> UpsertDiscoveredAsync(IReadOnlyList<DiscoveredPlace> places, CancellationToken ct);
    Task<bool> HasFreshCoverageAsync(string key, TimeSpan ttl, CancellationToken ct);
    Task MarkCoverageAsync(string key, string provider, string status, int count, CancellationToken ct);
    Task<IReadOnlyList<PlaceSignalDocument>> GetSignalsAsync(Guid placeId, int limit, CancellationToken ct);
    Task<IReadOnlyList<PlaceSignalDocument>> GetSignalsForPlacesAsync(IReadOnlyCollection<Guid> placeIds, int perPlaceLimit, CancellationToken ct);
    Task UpsertSignalAsync(PlaceSignalDocument signal, CancellationToken ct);
    Task EnsureIndexesAsync(CancellationToken ct);
}

public sealed class PlaceRepository : IPlaceRepository
{
    private readonly IMongoCollection<PlaceDocument> _places;
    private readonly IMongoCollection<PlaceSignalDocument> _signals;
    private readonly IMongoCollection<PlaceDiscoveryCoverageDocument> _coverage;

    public PlaceRepository(IMongoDatabase database)
    {
        _places = database.GetCollection<PlaceDocument>("places");
        _signals = database.GetCollection<PlaceSignalDocument>("place_signals");
        _coverage = database.GetCollection<PlaceDiscoveryCoverageDocument>("place_discovery_coverage");
    }

    public async Task<PlaceDocument?> GetAsync(Guid id, CancellationToken ct)
    {
        return await _places.Find(p => p.Id == id && p.IsActive).FirstOrDefaultAsync(ct);
    }

    public async Task<IReadOnlyList<PlaceDocument>> GetNearbyAsync(double lat, double lon, int radiusMeters, int limit, CancellationToken ct)
    {
        var deltaLat = radiusMeters / 111_000.0;
        var deltaLon = radiusMeters / (111_000.0 * Math.Max(Math.Cos(lat * Math.PI / 180), 0.1));
        var candidates = await GetBoundsAsync(lat - deltaLat, lon - deltaLon, lat + deltaLat, lon + deltaLon, Math.Max(limit * 4, limit), ct);

        return candidates
            .Select(p => new { Place = p, Distance = DistanceMeters(lat, lon, p.Latitude, p.Longitude) })
            .Where(p => p.Distance <= radiusMeters)
            .OrderBy(p => p.Distance)
            .Take(limit)
            .Select(p => p.Place)
            .ToArray();
    }

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

    public async Task<IReadOnlyList<PlaceDocument>> GetBoundsAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct)
    {
        var ring = new[]
        {
            new GeoJson2DGeographicCoordinates(minLon, minLat),
            new GeoJson2DGeographicCoordinates(maxLon, minLat),
            new GeoJson2DGeographicCoordinates(maxLon, maxLat),
            new GeoJson2DGeographicCoordinates(minLon, maxLat),
            new GeoJson2DGeographicCoordinates(minLon, minLat)
        };
        var polygon = new GeoJsonPolygon<GeoJson2DGeographicCoordinates>(
            new GeoJsonPolygonCoordinates<GeoJson2DGeographicCoordinates>(
                new GeoJsonLinearRingCoordinates<GeoJson2DGeographicCoordinates>(ring)));

        var filter = Builders<PlaceDocument>.Filter.And(
            Builders<PlaceDocument>.Filter.Eq(p => p.IsActive, true),
            Builders<PlaceDocument>.Filter.GeoWithin(p => p.Location, polygon));

        return await _places.Find(filter).Limit(limit).ToListAsync(ct);
    }

    public async Task<PlaceDocument> CreateAsync(CreatePlaceRequest request, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var place = new PlaceDocument
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Category = request.Category.Trim(),
            Latitude = request.Latitude,
            Longitude = request.Longitude,
            Location = new GeoJsonPoint<GeoJson2DGeographicCoordinates>(
                new GeoJson2DGeographicCoordinates(request.Longitude, request.Latitude)),
            DisplayAddress = request.DisplayAddress?.Trim(),
            Source = string.IsNullOrWhiteSpace(request.Source) ? "Manual" : request.Source.Trim(),
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            IsActive = true
        };

        await _places.InsertOneAsync(place, cancellationToken: ct);
        return place;
    }

    public async Task<IReadOnlyList<PlaceDocument>> UpsertDiscoveredAsync(IReadOnlyList<DiscoveredPlace> places, CancellationToken ct)
    {
        var result = new List<PlaceDocument>(places.Count);
        var now = DateTime.UtcNow;

        foreach (var discovered in places.Where(p => !string.IsNullOrWhiteSpace(p.Name) && !string.IsNullOrWhiteSpace(p.ExternalId)))
        {
            var filter = Builders<PlaceDocument>.Filter.And(
                Builders<PlaceDocument>.Filter.Eq(p => p.ExternalProvider, discovered.ExternalProvider),
                Builders<PlaceDocument>.Filter.Eq(p => p.ExternalId, discovered.ExternalId));
            var update = Builders<PlaceDocument>.Update
                .SetOnInsert(p => p.Id, Guid.NewGuid())
                .Set(p => p.Name, discovered.Name.Trim())
                .Set(p => p.Category, discovered.Category.Trim())
                .Set(p => p.Latitude, discovered.Latitude)
                .Set(p => p.Longitude, discovered.Longitude)
                .Set(p => p.Location, new GeoJsonPoint<GeoJson2DGeographicCoordinates>(
                    new GeoJson2DGeographicCoordinates(discovered.Longitude, discovered.Latitude)))
                .Set(p => p.DisplayAddress, discovered.DisplayAddress)
                .Set(p => p.Source, "External")
                .Set(p => p.ExternalProvider, discovered.ExternalProvider)
                .Set(p => p.ExternalId, discovered.ExternalId)
                .Set(p => p.UpdatedAtUtc, now)
                .Set(p => p.IsActive, true)
                .SetOnInsert(p => p.CreatedAtUtc, now);

            await _places.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true }, ct);
            var place = await _places.Find(filter).FirstOrDefaultAsync(ct);
            if (place is not null) result.Add(place);
        }

        return result;
    }

    public async Task<bool> HasFreshCoverageAsync(string key, TimeSpan ttl, CancellationToken ct)
    {
        var minRefreshedAt = DateTime.UtcNow.Subtract(ttl);
        var filter = Builders<PlaceDiscoveryCoverageDocument>.Filter.And(
            Builders<PlaceDiscoveryCoverageDocument>.Filter.Eq(c => c.Key, key),
            Builders<PlaceDiscoveryCoverageDocument>.Filter.Gte(c => c.RefreshedAtUtc, minRefreshedAt),
            Builders<PlaceDiscoveryCoverageDocument>.Filter.In(c => c.Status, new[] { "success", "empty" }));
        return await _coverage.Find(filter).AnyAsync(ct);
    }

    public async Task MarkCoverageAsync(string key, string provider, string status, int count, CancellationToken ct)
    {
        await _coverage.ReplaceOneAsync(
            c => c.Key == key,
            new PlaceDiscoveryCoverageDocument { Key = key, Provider = provider, Status = status, Count = count, RefreshedAtUtc = DateTime.UtcNow },
            new ReplaceOptions { IsUpsert = true },
            ct);
    }

    public async Task<IReadOnlyList<PlaceSignalDocument>> GetSignalsAsync(Guid placeId, int limit, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var filter = Builders<PlaceSignalDocument>.Filter.And(
            Builders<PlaceSignalDocument>.Filter.Eq(s => s.PlaceId, placeId),
            Builders<PlaceSignalDocument>.Filter.Or(
                Builders<PlaceSignalDocument>.Filter.Eq(s => s.ExpiresAtUtc, null),
                Builders<PlaceSignalDocument>.Filter.Gt(s => s.ExpiresAtUtc, now)));

        return await _signals.Find(filter).SortByDescending(s => s.CreatedAtUtc).Limit(limit).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<PlaceSignalDocument>> GetSignalsForPlacesAsync(IReadOnlyCollection<Guid> placeIds, int perPlaceLimit, CancellationToken ct)
    {
        if (placeIds.Count == 0) return Array.Empty<PlaceSignalDocument>();

        var now = DateTime.UtcNow;
        var filter = Builders<PlaceSignalDocument>.Filter.And(
            Builders<PlaceSignalDocument>.Filter.In(s => s.PlaceId, placeIds),
            Builders<PlaceSignalDocument>.Filter.Or(
                Builders<PlaceSignalDocument>.Filter.Eq(s => s.ExpiresAtUtc, null),
                Builders<PlaceSignalDocument>.Filter.Gt(s => s.ExpiresAtUtc, now)));

        var candidates = await _signals.Find(filter)
            .SortByDescending(s => s.CreatedAtUtc)
            .Limit(Math.Max(placeIds.Count * perPlaceLimit, perPlaceLimit))
            .ToListAsync(ct);

        return candidates
            .GroupBy(s => s.PlaceId)
            .SelectMany(g => g.Take(perPlaceLimit))
            .ToList();
    }

    public async Task UpsertSignalAsync(PlaceSignalDocument signal, CancellationToken ct)
    {
        await _signals.ReplaceOneAsync(
            s => s.PostId == signal.PostId,
            signal,
            new ReplaceOptions { IsUpsert = true },
            ct);
    }

    public async Task EnsureIndexesAsync(CancellationToken ct)
    {
        await _places.Indexes.CreateManyAsync(new[]
        {
            new CreateIndexModel<PlaceDocument>(
                Builders<PlaceDocument>.IndexKeys.Geo2DSphere(p => p.Location),
                new CreateIndexOptions { Name = "ix_places_location_2dsphere" }),
            new CreateIndexModel<PlaceDocument>(
                Builders<PlaceDocument>.IndexKeys.Ascending(p => p.IsActive).Ascending(p => p.Category),
                new CreateIndexOptions { Name = "ix_places_active_category" }),
            new CreateIndexModel<PlaceDocument>(
                Builders<PlaceDocument>.IndexKeys.Ascending(p => p.ExternalProvider).Ascending(p => p.ExternalId),
                new CreateIndexOptions { Name = "ux_places_external_identity", Unique = true, Sparse = true })
        }, ct);

        await _signals.Indexes.CreateManyAsync(new[]
        {
            new CreateIndexModel<PlaceSignalDocument>(
                Builders<PlaceSignalDocument>.IndexKeys.Ascending(s => s.PlaceId).Ascending(s => s.ExpiresAtUtc).Descending(s => s.CreatedAtUtc),
                new CreateIndexOptions { Name = "ix_place_signals_place_freshness" }),
            new CreateIndexModel<PlaceSignalDocument>(
                Builders<PlaceSignalDocument>.IndexKeys.Ascending(s => s.ExpiresAtUtc),
                new CreateIndexOptions { Name = "ix_place_signals_expires" })
        }, ct);

        await _coverage.Indexes.CreateOneAsync(
            new CreateIndexModel<PlaceDiscoveryCoverageDocument>(
                Builders<PlaceDiscoveryCoverageDocument>.IndexKeys.Ascending(c => c.RefreshedAtUtc),
                new CreateIndexOptions { Name = "ix_place_discovery_coverage_refreshed" }),
            cancellationToken: ct);
    }
}
