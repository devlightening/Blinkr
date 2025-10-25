using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using System.Net;

namespace BlogService.Infrastructure.Geocoding;

/// <summary>
/// Health check for geocoding service availability
/// </summary>
public sealed class GeocodingHealthCheck : IHealthCheck
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly NominatimOptions _options;

    public GeocodingHealthCheck(
        IHttpClientFactory httpClientFactory, 
        IOptions<NominatimOptions> options)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, 
        CancellationToken cancellationToken = default)
    {
        try
        {
            var client = _httpClientFactory.CreateClient(nameof(NominatimGeocodingService));
            
            // Simple test query (Istanbul coordinates)
            var response = await client.GetAsync(
                "reverse?format=jsonv2&lat=41&lon=29", 
                cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return HealthCheckResult.Healthy("Geocoding service is available");
            }
            else if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                return HealthCheckResult.Degraded(
                    $"Geocoding service rate limited: {(int)response.StatusCode} {response.ReasonPhrase}");
            }
            else
            {
                return HealthCheckResult.Degraded(
                    $"Geocoding service degraded: {(int)response.StatusCode} {response.ReasonPhrase}");
            }
        }
        catch (HttpRequestException ex)
        {
            return HealthCheckResult.Unhealthy("Geocoding service unreachable", ex);
        }
        catch (TaskCanceledException ex)
        {
            return HealthCheckResult.Unhealthy("Geocoding service timeout", ex);
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Geocoding service error", ex);
        }
    }
}
