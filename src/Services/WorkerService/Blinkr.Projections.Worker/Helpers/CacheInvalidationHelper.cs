using Microsoft.Extensions.Caching.Distributed;

namespace Blinkr.Projections.Worker.Helpers;

public static class CacheInvalidationHelper
{
    public static async Task InvalidatePostCache(IDistributedCache cache, Guid postId)
    {
        await cache.RemoveAsync($"post:{postId}");

        await cache.SetStringAsync(
            "feed:ver",
            Guid.NewGuid().ToString(),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(30)
            });
    }
}
