namespace BlogService.Api.RateLimiting;

/// <summary>
/// Rate limiting policy configuration
/// </summary>
public sealed class RateLimitPolicy
{
    /// <summary>
    /// Maximum number of tokens in the bucket
    /// </summary>
    public int Capacity { get; set; } = 60;

    /// <summary>
    /// Tokens refilled per second
    /// </summary>
    public double RefillPerSecond { get; set; } = 1.0;
}

/// <summary>
/// Rate limiting configuration options
/// </summary>
public sealed class RateLimitingOptions
{
    /// <summary>
    /// Enable/disable rate limiting
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Redis key prefix for rate limiting
    /// </summary>
    public string RedisKeyPrefix { get; set; } = "rl";

    /// <summary>
    /// Rate limiting policies by name
    /// </summary>
    public Dictionary<string, RateLimitPolicy> Policies { get; set; } = new();
}
