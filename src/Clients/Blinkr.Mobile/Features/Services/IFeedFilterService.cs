using Blinkr.Mobile.Core.Api;

namespace Blinkr.Mobile.Features.Services;

public interface IFeedFilterService
{
    Task<PagedResult<PostListDto>> GetNearbyAsync(int page = 1, int pageSize = 20);
    Task<PagedResult<PostListDto>> GetPopularAsync(int page = 1, int pageSize = 20);
    Task<PagedResult<PostListDto>> GetNewAsync(int page = 1, int pageSize = 20);
}
