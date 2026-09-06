using System.Text.Json;
using System.Text.Json.Serialization;
using System.Globalization;
using Microsoft.Extensions.Options;
using PlaceService.Api.Application;

namespace PlaceService.Api.Infrastructure;

public sealed class OverpassPlaceDiscoveryProvider : IPlaceDiscoveryProvider
{
    private readonly HttpClient _httpClient;
    private readonly PlaceDiscoveryOptions _options;
    private readonly ILogger<OverpassPlaceDiscoveryProvider> _logger;

    public OverpassPlaceDiscoveryProvider(HttpClient httpClient, IOptions<PlaceDiscoveryOptions> options, ILogger<OverpassPlaceDiscoveryProvider> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public string Name => "osm";

    public async Task<PlaceDiscoveryResult> DiscoverAsync(double minLat, double minLon, double maxLat, double maxLon, int limit, CancellationToken ct)
    {
        if (!_options.Enabled) return new PlaceDiscoveryResult(PlaceDiscoveryStatus.Empty, Array.Empty<DiscoveredPlace>());

        var query = FormattableString.Invariant($"""
        [out:json][timeout:20];
        (
          nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|fuel|cinema|theatre)$"]({minLat:R},{minLon:R},{maxLat:R},{maxLon:R});
          nwr["name"]["shop"]({minLat:R},{minLon:R},{maxLat:R},{maxLon:R});
          nwr["name"]["leisure"~"^(park|playground|sports_centre)$"]({minLat:R},{minLon:R},{maxLat:R},{maxLon:R});
          nwr["name"]["tourism"]({minLat:R},{minLon:R},{maxLat:R},{maxLon:R});
        );
        out center {Math.Clamp(limit, 1, 100)};
        """);

        try
        {
            using var response = await _httpClient.PostAsync(_options.OverpassUrl, new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("data", query)
            }), ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Blinkr Places] source: provider status={StatusCode}", response.StatusCode);
                return new PlaceDiscoveryResult(PlaceDiscoveryStatus.Failure, Array.Empty<DiscoveredPlace>(), response.StatusCode.ToString());
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            var payload = await JsonSerializer.DeserializeAsync<OverpassResponse>(stream, cancellationToken: ct);
            var places = payload?.Elements?
                .Select(ToDiscoveredPlace)
                .Where(p => p is not null)
                .Select(p => p!)
                .GroupBy(p => $"{p.ExternalProvider}:{p.ExternalId}")
                .Select(g => g.First())
                .Take(limit)
                .ToArray() ?? Array.Empty<DiscoveredPlace>();

            var status = places.Length == 0 ? PlaceDiscoveryStatus.Empty : PlaceDiscoveryStatus.Success;
            _logger.LogInformation("[Blinkr Places] source: provider status={Status} count={Count}", status, places.Length);
            return new PlaceDiscoveryResult(status, places);
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "[Blinkr Places] source: provider status=timeout");
            return new PlaceDiscoveryResult(PlaceDiscoveryStatus.Timeout, Array.Empty<DiscoveredPlace>(), "timeout");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "[Blinkr Places] source: provider failed");
            return new PlaceDiscoveryResult(PlaceDiscoveryStatus.Failure, Array.Empty<DiscoveredPlace>(), ex.Message);
        }
    }

    private static DiscoveredPlace? ToDiscoveredPlace(OverpassElement element)
    {
        if (element.Tags is null || !element.Tags.TryGetValue("name", out var name) || string.IsNullOrWhiteSpace(name))
        {
            return null;
        }

        var lat = element.Lat ?? element.Center?.Lat;
        var lon = element.Lon ?? element.Center?.Lon;
        if (!lat.HasValue || !lon.HasValue) return null;

        var category = ReadPrimaryCategory(element.Tags);
        var address = BuildAddress(element.Tags);

        return new DiscoveredPlace("osm", $"{element.Type}/{element.Id}", name, NormalizeCategory(category), lat.Value, lon.Value, address);
    }

    private static string ReadPrimaryCategory(IReadOnlyDictionary<string, string> tags) =>
        tags.GetValueOrDefault("amenity")
        ?? tags.GetValueOrDefault("shop")
        ?? tags.GetValueOrDefault("leisure")
        ?? tags.GetValueOrDefault("tourism")
        ?? tags.GetValueOrDefault("building")
        ?? "other";

    private static string NormalizeCategory(string raw)
    {
        var key = raw.Trim().ToLowerInvariant();
        return key switch
        {
            "cafe" => "CAFE",
            "restaurant" => "RESTAURANT",
            "fast_food" => "FAST_FOOD",
            "bar" or "pub" or "ice_cream" => "BAR",
            "supermarket" or "convenience" => "SUPERMARKET",
            "mall" or "shopping_centre" or "retail" or "commercial" => "SHOP",
            "park" or "garden" => "PARK",
            "playground" => "PLAYGROUND",
            "sports_centre" or "fitness_centre" or "stadium" => "SPORT",
            "hospital" or "clinic" or "pharmacy" or "doctors" or "dentist" => "HEALTH",
            "school" or "university" or "college" or "kindergarten" or "library" => "EDUCATION",
            "fuel" or "charging_station" => "FUEL",
            "bus_station" or "taxi" or "parking" => "TRANSPORT",
            "museum" or "attraction" or "gallery" or "viewpoint" => "TOURISM",
            "theatre" or "cinema" => "ENTERTAINMENT",
            "marketplace" or "community_centre" or "place_of_worship" or "townhall" or "social_facility" or "public" => "PUBLIC",
            _ when !string.IsNullOrWhiteSpace(key) => key.StartsWith("shop", StringComparison.Ordinal) ? "SHOP" : "OTHER",
            _ => "OTHER"
        };
    }

    private static string? BuildAddress(IReadOnlyDictionary<string, string> tags)
    {
        var parts = new[]
        {
            tags.GetValueOrDefault("addr:street"),
            tags.GetValueOrDefault("addr:housenumber"),
            tags.GetValueOrDefault("addr:district"),
            tags.GetValueOrDefault("addr:city")
        }.Where(p => !string.IsNullOrWhiteSpace(p)).ToArray();
        return parts.Length == 0 ? null : string.Join(", ", parts);
    }

    private sealed class OverpassResponse
    {
        [JsonPropertyName("elements")]
        public List<OverpassElement>? Elements { get; set; }
    }

    private sealed class OverpassElement
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;
        [JsonPropertyName("id")]
        public long Id { get; set; }
        [JsonPropertyName("lat")]
        public double? Lat { get; set; }
        [JsonPropertyName("lon")]
        public double? Lon { get; set; }
        [JsonPropertyName("center")]
        public OverpassCenter? Center { get; set; }
        [JsonPropertyName("tags")]
        public Dictionary<string, string>? Tags { get; set; }
    }

    private sealed class OverpassCenter
    {
        [JsonPropertyName("lat")]
        public double Lat { get; set; }
        [JsonPropertyName("lon")]
        public double Lon { get; set; }
    }
}
