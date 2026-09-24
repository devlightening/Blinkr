using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace IdentityService.Api.Account;

/// <summary>
/// Sign-in and sign-up protection (SECURITY.md S3):
/// <list type="bullet">
/// <item>per client IP: a sliding window on /api/auth/login and /register (<c>RateLimits:AuthPerMinute</c>, 30 by default;
/// Development raises it so the acceptance scripts are not throttled). Behind the Gateway the client IP is the first
/// X-Forwarded-For entry YARP adds; the services are never exposed directly.</item>
/// <item>per account: after 10 failed sign-ins within 15 minutes that account answers 429 TOO_MANY_ATTEMPTS until the
/// window passes, whatever the IP (slows down password guessing spread over many addresses). A success clears it.</item>
/// </list>
/// Both are in memory: fine for one instance; several instances need the Redis counters Blog already uses.
/// </summary>
public static class AuthThrottle
{
    public const string Policy = "auth";
    public const string ErrorCode = "TOO_MANY_ATTEMPTS";
    public const int MaxFailures = 10;
    public static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);

    public static IServiceCollection AddAuthThrottle(this IServiceCollection services, IConfiguration configuration)
    {
        var perMinute = Math.Clamp(configuration.GetValue("RateLimits:AuthPerMinute", 30), 1, 100_000);
        services.AddMemoryCache();
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsJsonAsync(new { error = ErrorCode, code = ErrorCode, message = "Çok fazla deneme yaptın. Biraz sonra tekrar dene." }, ct);
            };
            options.AddPolicy(Policy, http => RateLimitPartition.GetSlidingWindowLimiter(ClientIp(http), _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = perMinute,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
            }));
        });
        return services;
    }

    /// <summary>The caller's IP: the first X-Forwarded-For hop (set by the Gateway), else the connection.</summary>
    public static string ClientIp(HttpContext http)
    {
        var forwarded = http.Request.Headers["X-Forwarded-For"].ToString();
        var first = forwarded.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
        return !string.IsNullOrEmpty(first) ? first : http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static string Key(string? account) => $"auth-fail:{(account ?? string.Empty).Trim().ToLowerInvariant()}";

    /// <summary>True when this account has failed too often lately.</summary>
    public static bool IsLocked(IMemoryCache cache, string? account) =>
        cache.TryGetValue(Key(account), out int failures) && failures >= MaxFailures;

    public static void RecordFailure(IMemoryCache cache, string? account)
    {
        var key = Key(account);
        var failures = cache.TryGetValue(key, out int current) ? current + 1 : 1;
        cache.Set(key, failures, FailureWindow);
    }

    public static void RecordSuccess(IMemoryCache cache, string? account) => cache.Remove(Key(account));
}
