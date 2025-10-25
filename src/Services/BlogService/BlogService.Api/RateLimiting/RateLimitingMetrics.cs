using System.Diagnostics.Metrics;

namespace BlogService.Api.RateLimiting;

/// <summary>
/// Metrics for rate limiting observability
/// </summary>
public sealed class RateLimitingMetrics
{
    private readonly Meter _meter;
    private readonly Counter<long> _allowedCounter;
    private readonly Counter<long> _blockedCounter;
    private readonly Histogram<double> _retryAfterHistogram;
    private readonly Histogram<int> _remainingTokensHistogram;

    public RateLimitingMetrics()
    {
        _meter = new Meter("BlogService.RateLimiting", "1.0.0");
        
        _allowedCounter = _meter.CreateCounter<long>(
            "rate_limit_allowed_total",
            description: "Total number of allowed requests by policy");
            
        _blockedCounter = _meter.CreateCounter<long>(
            "rate_limit_blocked_total", 
            description: "Total number of blocked requests by policy");
            
        _retryAfterHistogram = _meter.CreateHistogram<double>(
            "rate_limit_retry_after_seconds",
            unit: "s",
            description: "Retry-After duration in seconds for blocked requests");
            
        _remainingTokensHistogram = _meter.CreateHistogram<int>(
            "rate_limit_remaining_tokens",
            description: "Remaining tokens in bucket after request");
    }

    /// <summary>
    /// Record an allowed request
    /// </summary>
    public void RecordAllowed(string policy, string identifier, int remainingTokens)
    {
        _allowedCounter.Add(1, new KeyValuePair<string, object?>("policy", policy));
        _remainingTokensHistogram.Record(remainingTokens, new KeyValuePair<string, object?>("policy", policy));
    }

    /// <summary>
    /// Record a blocked request
    /// </summary>
    public void RecordBlocked(string policy, string identifier, int retryAfterSeconds)
    {
        _blockedCounter.Add(1, new KeyValuePair<string, object?>("policy", policy));
        _retryAfterHistogram.Record(retryAfterSeconds, new KeyValuePair<string, object?>("policy", policy));
    }

    /// <summary>
    /// Dispose resources
    /// </summary>
    public void Dispose()
    {
        _meter?.Dispose();
    }
}
