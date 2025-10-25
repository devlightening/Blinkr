using System.Net.Http.Json;
using System.Globalization;
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
            
            var locationName = response?.display_name;
            
            if (!string.IsNullOrWhiteSpace(locationName))
            {
                _logger.LogDebug("🌍 Geocoding success: {LocationName}", locationName);
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
    }
}
