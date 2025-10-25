namespace BlogService.Api.RateLimiting;

/// <summary>
/// Rate limiting policy configuration
/// </summary>
public sealed class RateLimitPolicy
{
    private int _capacity = 60;
    private double _refillPerSecond = 1.0;

    /// <summary>
    /// Maximum number of tokens in the bucket (1-10000)
    /// </summary>
    public int Capacity 
    { 
        get => _capacity;
        set => _capacity = Math.Clamp(value, 1, 10000);
    }

    /// <summary>
    /// Tokens refilled per second (0.01-100.0)
    /// </summary>
    public double RefillPerSecond 
    { 
        get => _refillPerSecond;
        set => _refillPerSecond = Math.Clamp(value, 0.01, 100.0);
    }

    /// <summary>
    /// Validate policy configuration
    /// </summary>
    public bool IsValid => Capacity > 0 && RefillPerSecond > 0;
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
