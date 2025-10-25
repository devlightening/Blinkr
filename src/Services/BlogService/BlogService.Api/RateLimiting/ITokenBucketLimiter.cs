namespace BlogService.Api.RateLimiting;

/// <summary>
/// Token bucket rate limiter interface
/// </summary>
public interface ITokenBucketLimiter
{
    /// <summary>
    /// Attempt to acquire a token from the bucket
    /// </summary>
    /// <param name="policyName">Rate limiting policy name</param>
    /// <param name="identifier">Unique identifier (user ID or IP)</param>
    /// <param name="policy">Rate limiting policy configuration</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Tuple of (allowed, remaining tokens, reset seconds)</returns>
    Task<(bool Allowed, int Remaining, int ResetSeconds)> AcquireAsync(
        string policyName, 
        string identifier, 
        RateLimitPolicy policy, 
        CancellationToken cancellationToken = default);
}
