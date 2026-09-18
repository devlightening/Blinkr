using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using OsmSharp;
using OsmSharp.Streams;
using OsmSharp.Tags;
using System.Diagnostics;
using System.Globalization;

if (args.Length < 1 || args[0] is "-h" or "--help")
{
    Console.WriteLine("Usage: dotnet run --project src/Tools/Blinkr.Tools.OsmPlaceImporter -- <osm-file.osm|osm-file.osm.pbf> [mongodb://localhost:27017] [BlinkrPlaces]");
    return args.Length < 1 ? 1 : 0;
}

var osmPath = Path.GetFullPath(args[0]);
if (!File.Exists(osmPath)) throw new FileNotFoundException("OSM extract was not found.", osmPath);

var mongoConnection = args.ElementAtOrDefault(1)
    ?? Environment.GetEnvironmentVariable("BLINKR_MONGO_CONNECTION")
    ?? "mongodb://localhost:27017";
var databaseName = args.ElementAtOrDefault(2)
    ?? Environment.GetEnvironmentVariable("BLINKR_PLACE_DATABASE")
    ?? "BlinkrPlaces";

var total = Stopwatch.StartNew();
var geometryOnly = args.Contains("--geometry-only");
var client = new MongoClient(mongoConnection);
var database = client.GetDatabase(databaseName);
var places = database.GetCollection<PlaceDocument>("places");
var coverage = database.GetCollection<PlaceDiscoveryCoverageDocument>("place_discovery_coverage");

await EnsureIndexesAsync(places, coverage);

var nodeCoordinates = new Dictionary<long, Coordinate>();
var wayCenters = new Dictionary<long, Coordinate>();
var wayRings = new Dictionary<long, Coordinate[]>();
var candidates = 0;
var imported = 0;
var updated = 0;
var failed = 0;
var skippedWithoutCenter = 0;
var processed = 0;

await using var stream = File.OpenRead(osmPath);
var source = CreateSource(osmPath, stream);

foreach (var geo in source)
{
    processed++;
    if (geo is Node node && node.Id.HasValue && node.Latitude.HasValue && node.Longitude.HasValue)
    {
        var coordinate = new Coordinate(node.Latitude.Value, node.Longitude.Value);
        nodeCoordinates[node.Id.Value] = coordinate;
        if (!geometryOnly && TryCreatePlace(node, coordinate, out var place))
        {
            candidates++;
            var result = await UpsertAsync(places, place);
            if (result == ImportWriteResult.Imported) imported++;
            if (result == ImportWriteResult.Updated) updated++;
            if (result == ImportWriteResult.Failed) failed++;
        }
    }
    else if (geo is Way way && way.Id.HasValue)
    {
        var ring = way.Nodes?.Select(id => nodeCoordinates.GetValueOrDefault(id)).ToArray();
        if (ring is { Length: >= 4 } && ring.All(c => c is not null) && way.Nodes![0] == way.Nodes[^1])
            wayRings[way.Id.Value] = ring.Select(c => c!).ToArray();
        var center = CenterOf(way.Nodes?.Select(id => nodeCoordinates.GetValueOrDefault(id)).Where(c => c is not null).Select(c => c!).ToArray());
        if (center is not null) wayCenters[way.Id.Value] = center;
        if (TryCreatePlace(way, center, out var place))
        {
            if (wayRings.TryGetValue(way.Id.Value, out var footprint))
                place.GeometryWkt = $"POLYGON ({RingText(footprint)})";
            candidates++;
            var result = geometryOnly ? await UpdateGeometryAsync(places, place) : await UpsertAsync(places, place);
            if (result == ImportWriteResult.Imported) imported++;
            if (result == ImportWriteResult.Updated) updated++;
            if (result == ImportWriteResult.Failed) failed++;
        }
        else if (IsRelevantNamedPoi(way.Tags) && center is null)
        {
            skippedWithoutCenter++;
        }
    }
    else if (geo is Relation relation && relation.Id.HasValue)
    {
        var memberCenters = relation.Members?
            .Select(member => member.Type == OsmGeoType.Way ? wayCenters.GetValueOrDefault(member.Id) : nodeCoordinates.GetValueOrDefault(member.Id))
            .Where(c => c is not null)
            .Select(c => c!)
            .ToArray();
        var center = CenterOf(memberCenters);
        if (TryCreatePlace(relation, center, out var place))
        {
            // Only complete closed rings are trusted; incomplete relations retain point fallback.
            var members = relation.Members?.Where(m => m.Type == OsmGeoType.Way).ToArray() ?? [];
            if (members.Length > 0 && members.All(m => wayRings.ContainsKey(m.Id)))
            {
                var outers = members.Where(m => m.Role is "outer" or "").ToArray();
                var inners = members.Where(m => m.Role == "inner").ToArray();
                if (outers.Length == 1)
                    place.GeometryWkt = $"POLYGON ({string.Join(",", new[] { RingText(wayRings[outers[0].Id]) }.Concat(inners.Select(m => RingText(wayRings[m.Id]))))})";
                else if (inners.Length == 0 && outers.Length > 0)
                    place.GeometryWkt = $"MULTIPOLYGON ({string.Join(",", outers.Select(m => $"({RingText(wayRings[m.Id])})"))})";
            }
            candidates++;
            var result = geometryOnly ? await UpdateGeometryAsync(places, place) : await UpsertAsync(places, place);
            if (result == ImportWriteResult.Imported) imported++;
            if (result == ImportWriteResult.Updated) updated++;
            if (result == ImportWriteResult.Failed) failed++;
        }
        else if (IsRelevantNamedPoi(relation.Tags) && center is null)
        {
            skippedWithoutCenter++;
        }
    }
}

var importedCoverageKey = $"osm-import:{Path.GetFileName(osmPath)}";
if (!geometryOnly) await coverage.ReplaceOneAsync(
    c => c.Key == importedCoverageKey,
    new PlaceDiscoveryCoverageDocument
    {
        Key = importedCoverageKey,
        Provider = "osm-import",
        Status = "loaded",
        Count = candidates,
        RefreshedAtUtc = DateTime.UtcNow
    },
    new ReplaceOptions { IsUpsert = true });

Console.WriteLine($"Processed={processed}");
Console.WriteLine($"Candidates={candidates}");
Console.WriteLine($"Imported={imported}");
Console.WriteLine($"Updated={updated}");
Console.WriteLine($"Skipped={skippedWithoutCenter}");
Console.WriteLine($"Failed={failed}");
Console.WriteLine($"MongoTotalPlaces={await places.CountDocumentsAsync(FilterDefinition<PlaceDocument>.Empty)}");
Console.WriteLine($"MongoOsmPlaces={await places.CountDocumentsAsync(Builders<PlaceDocument>.Filter.Eq(p => p.ExternalProvider, "osm"))}");
Console.WriteLine($"ElapsedMs={total.ElapsedMilliseconds}");
return 0;

static OsmStreamSource CreateSource(string path, Stream stream)
{
    if (path.EndsWith(".pbf", StringComparison.OrdinalIgnoreCase)) return new PBFOsmStreamSource(stream);
    if (path.EndsWith(".osm", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".xml", StringComparison.OrdinalIgnoreCase)) return new XmlOsmStreamSource(stream);
    throw new InvalidOperationException("Unsupported OSM extract. Use .osm, .xml, or .osm.pbf.");
}

static string RingText(Coordinate[] ring) =>
    $"({string.Join(",", ring.Select(c => string.Create(CultureInfo.InvariantCulture, $"{c.Longitude:R} {c.Latitude:R}")))})";

static async Task<ImportWriteResult> UpdateGeometryAsync(IMongoCollection<PlaceDocument> places, PlaceDocument place)
{
    if (place.GeometryWkt is null) return ImportWriteResult.Skipped;
    var result = await places.UpdateOneAsync(p => p.ExternalProvider == "osm" && p.ExternalId == place.ExternalId,
        Builders<PlaceDocument>.Update.Set(p => p.GeometryWkt, place.GeometryWkt));
    return result.MatchedCount > 0 ? ImportWriteResult.Updated : ImportWriteResult.Skipped;
}

static bool TryCreatePlace(OsmGeo geo, Coordinate? coordinate, out PlaceDocument place)
{
    place = null!;
    if (coordinate is null || !geo.Id.HasValue || !IsRelevantNamedPoi(geo.Tags)) return false;
    var name = ReadTag(geo.Tags, "name");
    if (string.IsNullOrWhiteSpace(name)) return false;

    place = new PlaceDocument
    {
        Id = Guid.NewGuid(),
        Name = name.Trim(),
        Category = NormalizeCategory(ReadPrimaryCategory(geo.Tags)),
        Latitude = coordinate.Latitude,
        Longitude = coordinate.Longitude,
        Location = new GeoJsonPoint<GeoJson2DGeographicCoordinates>(
            new GeoJson2DGeographicCoordinates(coordinate.Longitude, coordinate.Latitude)),
        DisplayAddress = BuildAddress(geo.Tags),
        Source = "External",
        ExternalProvider = "osm",
        ExternalId = $"{OsmObjectType(geo)}/{geo.Id.Value}",
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow,
        IsActive = true
    };
    return true;
}

static bool IsRelevantNamedPoi(TagsCollectionBase? tags)
{
    if (string.IsNullOrWhiteSpace(ReadTag(tags, "name"))) return false;
    var primary = ReadPrimaryCategory(tags);
    if (string.IsNullOrWhiteSpace(primary)) return false;
    return NormalizeCategory(primary) != "OTHER" || HasAnyTag(tags, "shop", "amenity", "leisure", "tourism");
}

static string? ReadPrimaryCategory(TagsCollectionBase? tags)
{
    var amenity = ReadTag(tags, "amenity");
    if (!string.IsNullOrWhiteSpace(amenity))
    {
        if (amenity == "place_of_worship" && IsMosque(tags)) return "amenity:mosque";
        return $"amenity:{amenity}";
    }
    var shop = ReadTag(tags, "shop");
    if (!string.IsNullOrWhiteSpace(shop)) return $"shop:{shop}";
    var leisure = ReadTag(tags, "leisure");
    if (!string.IsNullOrWhiteSpace(leisure)) return $"leisure:{leisure}";
    var tourism = ReadTag(tags, "tourism");
    if (!string.IsNullOrWhiteSpace(tourism)) return $"tourism:{tourism}";
    return null;
}

static string NormalizeCategory(string? raw)
{
    var parts = (raw ?? string.Empty).Trim().ToLowerInvariant().Split(':', 2);
    var source = parts.Length == 2 ? parts[0] : string.Empty;
    var key = parts.Length == 2 ? parts[1] : parts[0];
    if (key.Contains("pharmacy", StringComparison.Ordinal)) return "PHARMACY";
    if (key.Contains("park", StringComparison.Ordinal)) return "PARK";
    if (key.Contains("bakery", StringComparison.Ordinal)) return "BAKERY";
    if (key.Contains("mosque", StringComparison.Ordinal)) return "MOSQUE";
    return key switch
    {
        "cafe" => "CAFE",
        "restaurant" => "RESTAURANT",
        "fast_food" => "FAST_FOOD",
        "bar" or "pub" => "BAR",
        "bakery" => "BAKERY",
        "supermarket" or "convenience" or "greengrocer" => "SUPERMARKET",
        "mall" or "shopping_centre" or "retail" or "commercial" => "SHOP",
        "park" or "garden" => "PARK",
        "playground" => "PLAYGROUND",
        "sports_centre" or "fitness_centre" or "stadium" => "SPORT",
        "pharmacy" => "PHARMACY",
        "hospital" or "clinic" or "doctors" or "dentist" => "HEALTH",
        "school" or "university" or "college" or "library" or "kindergarten" => "EDUCATION",
        "fuel" or "charging_station" => "FUEL",
        "taxi" or "bus_station" or "ferry_terminal" => "TRANSPORT",
        "museum" or "attraction" or "viewpoint" => "TOURISM",
        "cinema" or "theatre" => "ENTERTAINMENT",
        "place_of_worship" => "PLACE_OF_WORSHIP",
        "community_centre" or "marketplace" or "townhall" or "social_facility" or "public_building" => "PUBLIC",
        _ when source == "shop" && HasShopValue(key) => "SHOP",
        _ => "OTHER"
    };
}

static bool HasShopValue(string? key) => !string.IsNullOrWhiteSpace(key) && key != "vacant" && key != "no";

static string? BuildAddress(TagsCollectionBase? tags)
{
    var parts = new[]
    {
        ReadTag(tags, "addr:street"),
        ReadTag(tags, "addr:housenumber"),
        ReadTag(tags, "addr:district"),
        ReadTag(tags, "addr:city")
    }.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
    return parts.Length == 0 ? null : string.Join(", ", parts);
}

static string? ReadTag(TagsCollectionBase? tags, string key)
{
    if (tags is null) return null;
    foreach (var tag in tags)
    {
        if (string.Equals(tag.Key, key, StringComparison.Ordinal)) return tag.Value;
    }
    return null;
}

static bool HasAnyTag(TagsCollectionBase? tags, params string[] keys) => keys.Any(key => ReadTag(tags, key) is not null);

static bool IsMosque(TagsCollectionBase? tags) =>
    ReadTag(tags, "religion") == "muslim"
    || ReadTag(tags, "building") == "mosque"
    || ReadTag(tags, "name")?.Contains("Camii", StringComparison.OrdinalIgnoreCase) == true
    || ReadTag(tags, "name")?.Contains("Cami", StringComparison.OrdinalIgnoreCase) == true
    || ReadTag(tags, "name")?.Contains("Mescit", StringComparison.OrdinalIgnoreCase) == true;

static string OsmObjectType(OsmGeo geo) => geo switch
{
    Node => "node",
    Way => "way",
    Relation => "relation",
    _ => "unknown"
};

static Coordinate? CenterOf(IReadOnlyCollection<Coordinate>? coordinates)
{
    if (coordinates is null || coordinates.Count == 0) return null;
    return new Coordinate(coordinates.Average(c => c.Latitude), coordinates.Average(c => c.Longitude));
}

static async Task<ImportWriteResult> UpsertAsync(IMongoCollection<PlaceDocument> places, PlaceDocument place)
{
    try
    {
        var filter = Builders<PlaceDocument>.Filter.And(
            Builders<PlaceDocument>.Filter.Eq(p => p.ExternalProvider, place.ExternalProvider),
            Builders<PlaceDocument>.Filter.Eq(p => p.ExternalId, place.ExternalId));
        var update = Builders<PlaceDocument>.Update
            .SetOnInsert(p => p.Id, place.Id)
            .Set(p => p.Name, place.Name)
            .Set(p => p.Category, place.Category)
            .Set(p => p.Latitude, place.Latitude)
            .Set(p => p.Longitude, place.Longitude)
            .Set(p => p.Location, place.Location)
            .Set(p => p.DisplayAddress, place.DisplayAddress)
            .Set(p => p.Source, place.Source)
            .Set(p => p.ExternalProvider, place.ExternalProvider)
            .Set(p => p.ExternalId, place.ExternalId)
            .Set(p => p.UpdatedAtUtc, DateTime.UtcNow)
            .Set(p => p.IsActive, true)
            .SetOnInsert(p => p.CreatedAtUtc, DateTime.UtcNow);
        if (place.GeometryWkt is not null)
            update = update.Set(p => p.GeometryWkt, place.GeometryWkt);

        var result = await places.UpdateOneAsync(filter, update, new UpdateOptions { IsUpsert = true });
        return result.UpsertedId is not null ? ImportWriteResult.Imported : ImportWriteResult.Updated;
    }
    catch
    {
        return ImportWriteResult.Failed;
    }
}

static async Task EnsureIndexesAsync(
    IMongoCollection<PlaceDocument> places,
    IMongoCollection<PlaceDiscoveryCoverageDocument> coverage)
{
    await places.Indexes.CreateManyAsync(new[]
    {
        new CreateIndexModel<PlaceDocument>(
            Builders<PlaceDocument>.IndexKeys.Geo2DSphere(p => p.Location),
            new CreateIndexOptions { Name = "ix_places_location_2dsphere" }),
        new CreateIndexModel<PlaceDocument>(
            Builders<PlaceDocument>.IndexKeys.Ascending(p => p.ExternalProvider).Ascending(p => p.ExternalId),
            new CreateIndexOptions { Name = "ux_places_external_identity", Unique = true, Sparse = true })
    });
    await coverage.Indexes.CreateOneAsync(
        new CreateIndexModel<PlaceDiscoveryCoverageDocument>(
            Builders<PlaceDiscoveryCoverageDocument>.IndexKeys.Ascending(c => c.RefreshedAtUtc),
            new CreateIndexOptions { Name = "ix_place_discovery_coverage_refreshed" }));
}

public sealed class PlaceDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "Other";
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    [BsonIgnoreIfNull]
    public string? GeometryWkt { get; set; }
    public GeoJsonPoint<GeoJson2DGeographicCoordinates> Location { get; set; } = null!;
    public string? DisplayAddress { get; set; }
    public string Source { get; set; } = "External";
    [BsonIgnoreIfNull]
    public string? ExternalProvider { get; set; }
    [BsonIgnoreIfNull]
    public string? ExternalId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class PlaceDiscoveryCoverageDocument
{
    [BsonId]
    public string Key { get; set; } = string.Empty;
    public DateTime RefreshedAtUtc { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Status { get; set; } = "loaded";
    public int Count { get; set; }
}

public sealed record Coordinate(double Latitude, double Longitude);

public enum ImportWriteResult
{
    Skipped,
    Imported,
    Updated,
    Failed
}
