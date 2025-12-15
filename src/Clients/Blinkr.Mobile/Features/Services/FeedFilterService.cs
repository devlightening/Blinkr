using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features.Services;

public class FeedFilterService : IFeedFilterService
{
    private readonly IApiClient _apiClient;

    public FeedFilterService(IApiClient apiClient)
    {
        _apiClient = apiClient ?? throw new ArgumentNullException(nameof(apiClient));
    }

    public async Task<PagedResult<PostListDto>> GetNearbyAsync(int page = 1, int pageSize = 20)
    {
        try
        {
            var location = await Geolocation.GetLocationAsync(new GeolocationRequest
            {
                DesiredAccuracy = GeolocationAccuracy.Medium,
                Timeout = TimeSpan.FromSeconds(10)
            });

            if (location != null)
            {
                return await _apiClient.GetNearbyAsync(
                    lat: location.Latitude,
                    lon: location.Longitude,
                    radius: 5000,
                    page: page,
                    pageSize: pageSize);
            }

            return new PagedResult<PostListDto>(new List<PostListDto>(), 0, page, pageSize);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error getting nearby posts: {ex.Message}");
            return new PagedResult<PostListDto>(new List<PostListDto>(), 0, page, pageSize);
        }
    }

    public async Task<PagedResult<PostListDto>> GetPopularAsync(int page = 1, int pageSize = 20)
    {
        try
        {
            return await ApiClientExtensions.GetFeedAsync(_apiClient, page: page, pageSize: pageSize, sort: "likeCount:desc");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error getting popular posts: {ex.Message}");
            return new PagedResult<PostListDto>(new List<PostListDto>(), 0, page, pageSize);
        }
    }

    public async Task<PagedResult<PostListDto>> GetNewAsync(int page = 1, int pageSize = 20)
    {
        try
        {
            return await ApiClientExtensions.GetFeedAsync(_apiClient, page: page, pageSize: pageSize, sort: "createdAt:desc");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error getting new posts: {ex.Message}");
            return new PagedResult<PostListDto>(new List<PostListDto>(), 0, page, pageSize);
        }
    }
}
