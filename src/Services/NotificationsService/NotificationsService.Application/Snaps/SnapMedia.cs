using System.Text;

namespace NotificationsService.Application.Snaps;

/// <summary>Checks that uploaded bytes are really the declared media type and removes location metadata from photos.</summary>
public static class SnapMedia
{
    public static readonly string[] ImageTypes = { "image/jpeg", "image/png", "image/webp" };
    public static readonly string[] VideoTypes = { "video/mp4", "video/quicktime" };

    public static string NormalizeContentType(string? contentType) => (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant() switch
    {
        "image/jpg" or "image/pjpeg" => "image/jpeg",
        "video/x-m4v" => "video/mp4",
        var other => other,
    };

    public static bool IsImage(string contentType) => ImageTypes.Contains(contentType);
    public static bool IsVideo(string contentType) => VideoTypes.Contains(contentType);

    /// <summary>True when the leading bytes match the declared type (the header alone is never trusted).</summary>
    public static bool LooksValid(byte[] bytes, string contentType) => contentType switch
    {
        "image/jpeg" => bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8,
        "image/png" => bytes.Length > 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47,
        "image/webp" => bytes.Length > 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
        "video/mp4" or "video/quicktime" => LooksLikeIsoBaseMedia(bytes),
        _ => false,
    };

    private static bool LooksLikeIsoBaseMedia(byte[] bytes)
    {
        if (bytes.Length < 12) return false;
        for (var i = 0; i <= Math.Min(bytes.Length - 4, 32); i++)
            if (bytes[i] == 0x66 && bytes[i + 1] == 0x74 && bytes[i + 2] == 0x79 && bytes[i + 3] == 0x70) return true;
        return false;
    }

    /// <summary>Drops the APP0-APP15 segments of a JPEG (EXIF with GPS position, camera, time) and keeps the picture.</summary>
    public static byte[] StripJpegMetadata(byte[] bytes)
    {
        if (bytes.Length < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8) return bytes;

        using var output = new MemoryStream(bytes.Length);
        output.Write(bytes, 0, 2);
        var index = 2;
        while (index + 4 <= bytes.Length && bytes[index] == 0xFF)
        {
            var marker = bytes[index + 1];
            if (marker == 0xDA) break;
            var segmentLength = (bytes[index + 2] << 8) + bytes[index + 3];
            if (segmentLength < 2 || index + 2 + segmentLength > bytes.Length) break;
            var isMetadata = marker is >= 0xE0 and <= 0xEF;
            if (!isMetadata) output.Write(bytes, index, segmentLength + 2);
            index += segmentLength + 2;
        }
        output.Write(bytes, index, bytes.Length - index);
        return output.ToArray();
    }
}
