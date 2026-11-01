using System.Security.Claims;

namespace Shared.Moderation;

/// <summary>
/// The 24 h "no posting" sanction (sinyal-mvp-plan 11 §4), carried in the access token so every service can enforce it
/// without calling IdentityService. It takes effect with the next token (at most one access-token lifetime, 60 min).
/// </summary>
public static class PostingRestriction
{
    public const string ClaimType = "posting_restricted_until";
    public const string ErrorCode = "POSTING_RESTRICTED";

    public static Claim? ClaimFor(DateTime? restrictedUntilUtc, DateTime nowUtc) =>
        restrictedUntilUtc is { } until && until > nowUtc
            ? new Claim(ClaimType, new DateTimeOffset(DateTime.SpecifyKind(until, DateTimeKind.Utc)).ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
            : null;

    /// <summary>When the person may post again, or null when they may post now.</summary>
    public static DateTime? RestrictedUntil(ClaimsPrincipal user, DateTime nowUtc)
    {
        var raw = user.FindFirst(ClaimType)?.Value;
        if (raw is null || !long.TryParse(raw, out var seconds)) return null;
        var until = DateTimeOffset.FromUnixTimeSeconds(seconds).UtcDateTime;
        return until > nowUtc ? until : null;
    }
}
