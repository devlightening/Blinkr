using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace BlogService.Api.RateLimiting;

/// <summary>
/// Middleware for API rate limiting with path-based policy selection
/// </summary>
public sealed class RateLimitingMiddleware : IMiddleware
{
    private readonly ITokenBucketLimiter _limiter;
    private readonly RateLimitingOptions _options;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly RateLimitingMetrics _metrics;

    public RateLimitingMiddleware(
        ITokenBucketLimiter limiter, 
        IOptions<RateLimitingOptions> options,
        ILogger<RateLimitingMiddleware> logger,
        RateLimitingMetrics metrics)
    {
        _limiter = limiter;
        _options = options.Value;
        _logger = logger;
        _metrics = metrics;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        // Skip if rate limiting is disabled
        if (!_options.Enabled)
        {
            await next(context);
            return;
        }

        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;

        // Bypass health checks and swagger
        if (path.StartsWith("/health") || path.StartsWith("/swagger") || path.StartsWith("/_"))
        {
            await next(context);
            return;
        }

        // Policy selection based on path and method
        string? policyName = SelectPolicy(method, path);
        
        if (policyName is null || !_options.Policies.TryGetValue(policyName, out var policy))
        {
            await next(context);
            return;
        }

        // Create identifier: prefer user ID, fallback to IP
        var identifier = CreateIdentifier(context);

        try
        {
            var (allowed, remaining, resetSeconds) = await _limiter.AcquireAsync(
                policyName, identifier, policy, context.RequestAborted);

            // Add rate limit headers (RFC 9237 draft)
            context.Response.Headers["RateLimit-Limit"] = policy.Capacity.ToString();
            context.Response.Headers["RateLimit-Remaining"] = Math.Max(0, remaining).ToString();
            context.Response.Headers["RateLimit-Reset"] = resetSeconds.ToString();

            if (!allowed)
            {
                // Record blocked request metrics
                _metrics.RecordBlocked(policyName, identifier, resetSeconds);
                
                _logger.LogWarning("Rate limit exceeded for {Policy} by {Identifier}. Reset in {ResetSeconds}s. " +
                    "Remaining: {Remaining}", policyName, identifier, resetSeconds, remaining);

                context.Response.Headers["Retry-After"] = resetSeconds.ToString();
                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.ContentType = "application/json";
                
                var errorResponse = new
                {
                    error = "rate_limited",
                    policy = policyName,
                    message = $"Rate limit exceeded for {policyName}. Please retry after {resetSeconds} seconds.",
                    retryAfterSeconds = resetSeconds,
                    identifier = identifier.Split('|')[0] // Don't expose full composite identifier
                };
                
                await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(errorResponse));
                return;
            }

            // Record allowed request metrics
            _metrics.RecordAllowed(policyName, identifier, remaining);
            
            _logger.LogDebug("Rate limit check passed for {Policy} by {Identifier}. Remaining: {Remaining}/{Capacity}", 
                policyName, identifier, remaining, policy.Capacity);

            await next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Rate limiting error for {Policy} by {Identifier}. Allowing request.", 
                policyName, identifier);
            
            // On error, allow the request to proceed
            await next(context);
        }
    }

    /// <summary>
    /// Select rate limiting policy based on HTTP method and path
    /// </summary>
    private static string? SelectPolicy(string method, string path)
    {
        return (method, path) switch
        {
            ("GET", var p) when p.StartsWith("/api/posts-read/nearby") => "Nearby",
            ("POST", var p) when p.StartsWith("/api/posts/") && p.EndsWith("/location") => "PostLocation",
            _ => null
        };
    }

    /// <summary>
    /// Create unique identifier for rate limiting
    /// Uses composite identifier (user+IP) to prevent session sharing abuse
    /// </summary>
    private static string CreateIdentifier(HttpContext context)
    {
        // Get user ID from JWT claims
        var userId = context.User?.FindFirstValue("sub") ?? context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        
        // Get IP address (ForwardedHeaders middleware handles X-Forwarded-For)
        var ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        // Composite identifier to prevent session sharing abuse
        if (!string.IsNullOrWhiteSpace(userId))
        {
            return $"u:{userId}|ip:{ipAddress}";
        }

        return $"ip:{ipAddress}";
    }
}
