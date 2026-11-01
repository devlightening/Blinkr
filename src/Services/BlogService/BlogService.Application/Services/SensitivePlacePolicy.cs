namespace BlogService.Application.Services;

/// <summary>
/// Sensitive places (sinyal-mvp-plan 11_SAFETY §3). Photos and videos are never accepted on an EDUCATION place
/// (school, kindergarten - and, because the catalogue only keeps the normalized category, also university/library):
/// child safety is enforced here on the server, not only hidden in the app.
/// </summary>
public static class SensitivePlacePolicy
{
    public const string MediaNotAllowedCode = "MEDIA_NOT_ALLOWED_AT_PLACE";

    public static bool BlocksMedia(string? category) =>
        string.Equals(category, "EDUCATION", StringComparison.OrdinalIgnoreCase);
}

public sealed class PlaceMediaNotAllowedException : Exception
{
    public PlaceMediaNotAllowedException()
        : base("Bu yerde fotoğraf veya video paylaşılamaz; yalnız yazılı sinyal gönderilebilir.")
    {
    }
}
