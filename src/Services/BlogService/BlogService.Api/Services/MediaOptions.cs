namespace BlogService.Api.Services;

public sealed class MediaOptions
{
    public int MaxMediaPerPost { get; set; } = 4;
    public long MaxImageBytes { get; set; } = 8_000_000;
    public long MaxVideoBytes { get; set; } = 80_000_000;
    public int PresignExpiryMinutes { get; set; } = 10;
    public int OrphanCleanupHours { get; set; } = 24;
    public string LocalStorageRoot { get; set; } = "artifacts/media";
    public string PublicBasePath { get; set; } = "/api/v1/media/public";
    public string[] AllowedImageContentTypes { get; set; } = { "image/jpeg", "image/png", "image/webp" };
    public string[] AllowedVideoContentTypes { get; set; } = { "video/mp4", "video/quicktime" };
}

