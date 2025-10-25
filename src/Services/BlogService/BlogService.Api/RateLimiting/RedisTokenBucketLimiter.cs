using StackExchange.Redis;
using Microsoft.Extensions.Options;

namespace BlogService.Api.RateLimiting;

/// <summary>
/// Redis-based token bucket rate limiter using Lua script for atomic operations
/// </summary>
public sealed class RedisTokenBucketLimiter : ITokenBucketLimiter
{
    private readonly IDatabase _database;
    private readonly string _keyPrefix;

    // Lua script for atomic token bucket operations
    private const string LuaScriptText = @"
local key       = KEYS[1]
local nowMs     = tonumber(ARGV[1])
local capacity  = tonumber(ARGV[2])
local refill    = tonumber(ARGV[3])  -- tokens per second

local state = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts     = tonumber(state[2])

if not tokens or not ts then
  tokens = capacity
  ts = nowMs
end

local elapsed = math.max(0, nowMs - ts)
local refillTokens = (elapsed / 1000.0) * refill
tokens = math.min(capacity, tokens + refillTokens)

local allowed = 0
local resetSec = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  local missing = 1 - tokens
  resetSec = math.ceil(missing / refill)
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', nowMs)

-- Dynamic TTL: 2x refill time, minimum 1 hour
local ttl = math.max(3600, math.ceil((capacity / refill) * 2))
redis.call('EXPIRE', key, ttl)

return { allowed, math.floor(tokens), resetSec }
";

    public RedisTokenBucketLimiter(
        IConnectionMultiplexer connectionMultiplexer, 
        IOptions<RateLimitingOptions> options)
    {
        _database = connectionMultiplexer.GetDatabase();
        
        // Environment-aware key prefix to avoid cross-environment conflicts
        var env = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Prod";
        var basePrefix = options.Value.RedisKeyPrefix ?? "rl";
        _keyPrefix = $"{env.ToLowerInvariant()}:{basePrefix}";
    }

    public async Task<(bool Allowed, int Remaining, int ResetSeconds)> AcquireAsync(
        string policyName, 
        string identifier, 
        RateLimitPolicy policy, 
        CancellationToken cancellationToken = default)
    {
        var key = $"{_keyPrefix}:{policyName}:{identifier}";
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var result = (RedisResult[])(await _database.ScriptEvaluateAsync(
            LuaScriptText, 
            keys: new RedisKey[] { key },
            values: new RedisValue[] { nowMs, policy.Capacity, policy.RefillPerSecond }));

        var allowed = (int)result[0] == 1;
        var remaining = (int)result[1];
        var resetSeconds = (int)result[2];

        return (allowed, remaining, resetSeconds);
    }
}
