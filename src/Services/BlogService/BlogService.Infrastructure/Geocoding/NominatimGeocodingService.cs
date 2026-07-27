using System.Net.Http.Json;
using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using BlogService.Application.Services;

namespace BlogService.Infrastructure.Geocoding;

/// <summary>
/// Nominatim-based geocoding service implementation
/// </summary>
public sealed class NominatimGeocodingService : IGeocodingService
{
    private readonly HttpClient _httpClient;
    private readonly NominatimOptions _options;
    private readonly ILogger<NominatimGeocodingService> _logger;

    public NominatimGeocodingService(
        HttpClient httpClient, 
        IOptions<NominatimOptions> options,
        ILogger<NominatimGeocodingService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string?> TryReverseAsync(double lat, double lon, CancellationToken ct = default)
    {
        try
        {
            var latString = lat.ToString(CultureInfo.InvariantCulture);
            var lonString = lon.ToString(CultureInfo.InvariantCulture);
            var url = $"reverse?format=jsonv2&lat={latString}&lon={lonString}&accept-language={_options.Culture}";

            _logger.LogDebug("🌍 Nominatim reverse geocoding: lat={Lat}, lon={Lon}", lat, lon);

            var response = await _httpClient.GetFromJsonAsync<NominatimReverseResponse>(url, ct);
            
            if (response == null)
            {
                _logger.LogDebug("🌍 Geocoding returned null response");
                return null;
            }

            // Extract city/province from address component (preferred for Turkish addresses)
            var cityName = ExtractCityFromAddress(response.address);
            if (!string.IsNullOrWhiteSpace(cityName))
            {
                _logger.LogDebug("🌍 Geocoding success (city): {CityName}", cityName);
                return cityName;
            }
            
            // Fallback to display_name if address component not available
            var locationName = response.display_name;
            if (!string.IsNullOrWhiteSpace(locationName))
            {
                _logger.LogDebug("🌍 Geocoding success (display_name): {LocationName}", locationName);
                return locationName;
            }
            else
            {
                _logger.LogDebug("🌍 Geocoding returned empty result");
                return null;
            }
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "🌍 Geocoding HTTP error: lat={Lat}, lon={Lon}", lat, lon);
            return null; // Fail-safe: don't break the flow
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "🌍 Geocoding timeout: lat={Lat}, lon={Lon}", lat, lon);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "🌍 Geocoding unexpected error: lat={Lat}, lon={Lon}", lat, lon);
            return null;
        }
    }

    /// <summary>
    /// Nominatim API response model
    /// </summary>
    private sealed class NominatimReverseResponse
    {
        public string? display_name { get; set; }
        public string? place_id { get; set; }
        public string? osm_type { get; set; }
        public string? osm_id { get; set; }
        public AddressComponent? address { get; set; }
    }

    /// <summary>
    /// Address component from Nominatim (supports both English and Turkish property names)
    /// </summary>
    private sealed class AddressComponent
    {
        [JsonPropertyName("state")]
        public string? State { get; set; }  // İl (province)
        
        [JsonPropertyName("city")]
        public string? City { get; set; }
        
        [JsonPropertyName("town")]
        public string? Town { get; set; }
        
        [JsonPropertyName("village")]
        public string? Village { get; set; }
        
        [JsonPropertyName("county")]
        public string? County { get; set; }
        
        // Turkish property names (fallback)
        [JsonPropertyName("il")]
        public string? Il { get; set; }
        
        [JsonPropertyName("şehir")]
        public string? Sehir { get; set; }
        
        [JsonPropertyName("ilçe")]
        public string? Ilce { get; set; }
        
        // Store unknown properties for flexible parsing
        [JsonExtensionData]
        public Dictionary<string, object?>? ExtensionData { get; set; }
    }

    /// <summary>
    /// Extract city/province name from full address for Turkish locations
    /// Priority: state/il > city/şehir > town/ilçe > village > county
    /// </summary>
    private static string? ExtractCityFromAddress(AddressComponent? address)
    {
        if (address == null) return null;
        
        // Turkish addresses: state = il (province) - this is the preferred field
        var locationName = address.State 
            ?? address.Il 
            ?? address.City 
            ?? address.Sehir 
            ?? address.Town 
            ?? address.Ilce 
            ?? address.Village 
            ?? address.County;
            
        // If still null, try extension data (for unknown property names)
        if (string.IsNullOrWhiteSpace(locationName) && address.ExtensionData != null)
        {
            // Try common property names from extension data
            locationName = address.ExtensionData
                .FirstOrDefault(kvp => 
                    kvp.Key.Equals("state", StringComparison.OrdinalIgnoreCase) ||
                    kvp.Key.Equals("il", StringComparison.OrdinalIgnoreCase) ||
                    kvp.Key.Equals("city", StringComparison.OrdinalIgnoreCase) ||
                    kvp.Key.Equals("şehir", StringComparison.OrdinalIgnoreCase))
                .Value?.ToString();
        }
        
        return locationName;
    }
}
