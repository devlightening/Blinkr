namespace BlogService.Application.Services;

/// <summary>
/// A photo from the gallery that is more than two hours old cannot vouch for "right now" (sinyal-mvp-plan 05 §1.1,
/// P5.11). The capture time comes from the client (the server strips EXIF on upload), so it can only ever lower
/// trust, never raise it: an old photo downgrades a VERIFIED_LIVE post to NEARBY_PLACE_POST, which still shows as
/// content but never changes the place's live state (kök CLAUDE.md §10.2).
/// </summary>
public static class GalleryMediaPolicy
{
    public static readonly TimeSpan LiveWindow = TimeSpan.FromHours(2);

    /// <summary>plan-devam D10: the card labels such a photo "Galeriden". Only this flag is kept, never the capture time.</summary>
    public static bool IsOldGalleryMedia(bool hasMedia, DateTime? mediaCapturedAtUtc, DateTime nowUtc) =>
        hasMedia && mediaCapturedAtUtc.HasValue && nowUtc - DateTime.SpecifyKind(mediaCapturedAtUtc.Value, DateTimeKind.Utc) > LiveWindow;

    public static string? CapTrust(string? trustLevel, bool hasMedia, DateTime? mediaCapturedAtUtc, DateTime nowUtc)
    {
        if (!hasMedia || !mediaCapturedAtUtc.HasValue) return trustLevel;
        var age = nowUtc - DateTime.SpecifyKind(mediaCapturedAtUtc.Value, DateTimeKind.Utc);
        return age > LiveWindow && trustLevel == "VERIFIED_LIVE" ? "NEARBY_PLACE_POST" : trustLevel;
    }
}
