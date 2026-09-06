using BlogService.Application.Services;
using System.Net.Http.Json;

namespace BlogService.Api.Services;

public sealed class HttpPlaceLookupService : IPlaceLookupService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<HttpPlaceLookupService> _logger;

    public HttpPlaceLookupService(HttpClient httpClient, ILogger<HttpPlaceLookupService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<bool> ExistsAsync(Guid placeId, CancellationToken ct)
    {
        return await GetAsync(placeId, ct) is not null;
    }

    public async Task<PlaceLookupResult?> GetAsync(Guid placeId, CancellationToken ct)
    {
        try
        {
            using var response = await _httpClient.GetAsync($"/api/places/{placeId}", ct);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<PlaceLookupResult>(cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Place lookup failed for PlaceId={PlaceId}", placeId);
            throw new InvalidOperationException("Place validation is unavailable.", ex);
        }
    }
}
