using BlogService.Application.Services;
using BlogService.Domain.Enums;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using System.Text;

namespace BlogService.Api.Services;

public sealed class MediaAttachmentService : IMediaAttachmentService
{
    private readonly IMongoCollection<MediaUploadDocument> _uploads;
    private readonly IWebHostEnvironment _env;
    private readonly MediaOptions _options;

    public MediaAttachmentService(IMongoDatabase database, IWebHostEnvironment env, IOptions<MediaOptions> options)
    {
        _uploads = database.GetCollection<MediaUploadDocument>("media_uploads");
        _env = env;
        _options = options.Value;
    }

    public async Task<MediaUploadAuthorization> CreateUploadAsync(Guid ownerUserId, CreateMediaUploadRequest request, CancellationToken ct)
    {
        var contentType = NormalizeContentType(request.ContentType);
        var mediaType = ResolveMediaType(contentType);
        ValidateRequest(request, mediaType);

        var id = Guid.NewGuid();
        var extension = GetSafeExtension(contentType);
        var key = $"u/{ownerUserId:N}/{id:N}{extension}";
        var expiresAt = DateTime.UtcNow.AddMinutes(_options.PresignExpiryMinutes);
        var publicUrl = $"{_options.PublicBasePath}/{id}";

        var doc = new MediaUploadDocument
        {
            Id = id,
            OwnerUserId = ownerUserId,
            MediaType = mediaType,
            ObjectKey = key,
            PublicUrl = publicUrl,
            ContentType = contentType,
            SizeBytes = request.SizeBytes,
            Width = request.Width,
            Height = request.Height,
            DurationSeconds = request.DurationSeconds,
            Status = "PENDING",
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = expiresAt
        };

        await _uploads.InsertOneAsync(doc, cancellationToken: ct);

        return new MediaUploadAuthorization(
            id,
            $"/api/v1/media/uploads/{id}/content",
            new DateTimeOffset(expiresAt, TimeSpan.Zero),
            publicUrl,
            new Dictionary<string, string> { ["Content-Type"] = contentType });
    }

    public async Task MarkUploadedAsync(Guid ownerUserId, Guid mediaId, Stream content, string contentType, CancellationToken ct)
    {
        var doc = await _uploads.Find(x => x.Id == mediaId).FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Media not found.");
        if (doc.OwnerUserId != ownerUserId) throw new UnauthorizedAccessException("Media belongs to another user.");
        if (doc.Status != "PENDING") throw new InvalidOperationException("Media is not waiting for upload.");
        if (doc.ExpiresAtUtc <= DateTime.UtcNow) throw new InvalidOperationException("Upload authorization expired.");
        if (!UploadContentTypeAccepted(doc, contentType))
            throw new ArgumentException("Content-Type does not match presign request.");

        var maxBytes = doc.MediaType == MediaType.Video ? _options.MaxVideoBytes : _options.MaxImageBytes;

        var relativePath = doc.ObjectKey.Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_env.ContentRootPath, _options.LocalStorageRoot, relativePath));
        var root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, _options.LocalStorageRoot));
        if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Unsafe object key.");

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        await using var memory = new MemoryStream();
        var buffer = new byte[81920];
        long bytesWritten = 0;
        int read;
        while ((read = await content.ReadAsync(buffer, ct)) > 0)
        {
            bytesWritten += read;
            if (bytesWritten > maxBytes) throw new ArgumentOutOfRangeException(nameof(content), "Media size is outside the configured limit.");
            await memory.WriteAsync(buffer.AsMemory(0, read), ct);
        }
        if (bytesWritten == 0) throw new ArgumentOutOfRangeException(nameof(content), "Media size is outside the configured limit.");
        var bytes = SanitizeAndValidate(memory.ToArray(), doc.ContentType, doc.MediaType);

        await File.WriteAllBytesAsync(fullPath, bytes, ct);

        var update = Builders<MediaUploadDocument>.Update
            .Set(x => x.Status, "READY")
            .Set(x => x.UploadedAtUtc, DateTime.UtcNow)
            .Set(x => x.SizeBytes, bytes.Length);
        await _uploads.UpdateOneAsync(x => x.Id == mediaId, update, cancellationToken: ct);
    }

    public async Task<MediaUploadAuthorization?> GetUploadAsync(Guid ownerUserId, Guid mediaId, CancellationToken ct)
    {
        var doc = await _uploads.Find(x => x.Id == mediaId && x.OwnerUserId == ownerUserId).FirstOrDefaultAsync(ct);
        return doc is null ? null : ToAuthorization(doc);
    }

    public async Task<IReadOnlyList<AttachedMedia>> ClaimForPostAsync(Guid ownerUserId, Guid postId, IReadOnlyCollection<Guid> mediaIds, CancellationToken ct)
    {
        if (mediaIds.Count == 0) return Array.Empty<AttachedMedia>();
        if (mediaIds.Count > _options.MaxMediaPerPost) throw new ArgumentException($"A post can attach at most {_options.MaxMediaPerPost} media items.");
        if (mediaIds.Count != mediaIds.Distinct().Count()) throw new ArgumentException("Duplicate media ids are not allowed.");

        var docs = await _uploads.Find(x => mediaIds.Contains(x.Id)).ToListAsync(ct);
        if (docs.Count != mediaIds.Count) throw new KeyNotFoundException("One or more media items were not found.");
        if (docs.Any(x => x.OwnerUserId != ownerUserId)) throw new UnauthorizedAccessException("Media belongs to another user.");
        if (docs.Any(x => x.Status != "READY")) throw new InvalidOperationException("Media must be ready before it can be attached.");
        if (docs.Any(x => x.PostId.HasValue && x.PostId.Value != postId)) throw new InvalidOperationException("Media is already attached to another post.");

        var update = Builders<MediaUploadDocument>.Update
            .Set(x => x.PostId, postId)
            .Set(x => x.Status, "ATTACHED")
            .Set(x => x.AttachedAtUtc, DateTime.UtcNow);
        await _uploads.UpdateManyAsync(x => mediaIds.Contains(x.Id), update, cancellationToken: ct);

        return docs.Select(x => new AttachedMedia(x.Id, x.PublicUrl, x.MediaType, x.ContentType, x.SizeBytes, x.Width, x.Height, x.DurationSeconds, x.ThumbnailUrl)).ToList();
    }

    public async Task<int> DeleteAllForOwnerAsync(Guid ownerUserId, CancellationToken ct)
    {
        var docs = await _uploads.Find(x => x.OwnerUserId == ownerUserId).ToListAsync(ct);
        foreach (var doc in docs) DeleteStoredObject(doc.ObjectKey);
        await _uploads.DeleteManyAsync(x => x.OwnerUserId == ownerUserId, ct);
        return docs.Count;
    }

    public async Task<int> MarkExpiredOrphansAsync(TimeSpan olderThan, CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow.Subtract(olderThan);
        var orphans = await _uploads.Find(x => !x.PostId.HasValue && x.CreatedAtUtc < cutoff && x.Status != "EXPIRED").ToListAsync(ct);
        foreach (var orphan in orphans)
        {
            DeleteStoredObject(orphan.ObjectKey);
        }

        var result = await _uploads.UpdateManyAsync(
            x => !x.PostId.HasValue && x.CreatedAtUtc < cutoff && x.Status != "EXPIRED",
            Builders<MediaUploadDocument>.Update.Set(x => x.Status, "EXPIRED"),
            cancellationToken: ct);
        return (int)result.ModifiedCount;
    }

    private MediaUploadAuthorization ToAuthorization(MediaUploadDocument doc) =>
        new(doc.Id, $"/api/v1/media/uploads/{doc.Id}/content", new DateTimeOffset(doc.ExpiresAtUtc, TimeSpan.Zero), doc.PublicUrl, new Dictionary<string, string> { ["Content-Type"] = doc.ContentType });

    /// <summary>
    /// The presigned type and the PUT header can legitimately differ in spelling (image/jpg vs image/jpeg) or be
    /// rewritten by a mobile HTTP stack (a Blob body carries its own type; some file URIs report none). The bytes
    /// are still checked against the declared type by <see cref="SanitizeAndValidate"/>, so the header only has to
    /// agree on the kind of media: an image upload must not arrive as a video, and vice versa.
    /// </summary>
    private bool UploadContentTypeAccepted(MediaUploadDocument doc, string headerContentType)
    {
        var declared = NormalizeContentType(doc.ContentType);
        var actual = NormalizeContentType(headerContentType);
        if (string.Equals(declared, actual, StringComparison.OrdinalIgnoreCase)) return true;
        if (actual.Length == 0 || actual == "application/octet-stream") return true;

        var sameKind = doc.MediaType == MediaType.Video
            ? _options.AllowedVideoContentTypes.Contains(actual, StringComparer.OrdinalIgnoreCase)
            : _options.AllowedImageContentTypes.Contains(actual, StringComparer.OrdinalIgnoreCase);
        return sameKind;
    }

    private static string NormalizeContentType(string? contentType) => (contentType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant() switch
    {
        "image/jpg" or "image/pjpeg" => "image/jpeg",
        "video/x-m4v" => "video/mp4",
        var other => other
    };

    private MediaType ResolveMediaType(string contentType)
    {
        if (_options.AllowedImageContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase)) return MediaType.Image;
        if (_options.AllowedVideoContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase)) return MediaType.Video;
        throw new ArgumentException("Unsupported media type.");
    }

    private void ValidateRequest(CreateMediaUploadRequest request, MediaType mediaType)
    {
        var maxBytes = mediaType == MediaType.Video ? _options.MaxVideoBytes : _options.MaxImageBytes;
        if (request.SizeBytes is <= 0 || request.SizeBytes > maxBytes) throw new ArgumentOutOfRangeException(nameof(request.SizeBytes), "Media size is outside the configured limit.");
        if (request.FileName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) throw new ArgumentException("Invalid file name.");
    }

    private static string GetSafeExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/webp" => ".webp",
        "video/mp4" => ".mp4",
        "video/quicktime" => ".mov",
        _ => ".bin"
    };

    private void DeleteStoredObject(string objectKey)
    {
        var relativePath = objectKey.Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.GetFullPath(Path.Combine(_env.ContentRootPath, _options.LocalStorageRoot, relativePath));
        var root = Path.GetFullPath(Path.Combine(_env.ContentRootPath, _options.LocalStorageRoot));
        if (!fullPath.StartsWith(root, StringComparison.OrdinalIgnoreCase)) return;
        if (File.Exists(fullPath)) File.Delete(fullPath);
    }

    private static byte[] SanitizeAndValidate(byte[] bytes, string contentType, MediaType mediaType)
    {
        var valid = contentType.ToLowerInvariant() switch
        {
            "image/jpeg" => bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8,
            "image/png" => bytes.Length > 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47,
            "image/webp" => bytes.Length > 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP",
            "video/mp4" or "video/quicktime" => LooksLikeIsoBaseMedia(bytes),
            _ => false
        };
        if (!valid) throw new ArgumentException("Uploaded bytes do not match the declared media type.");

        if (mediaType != MediaType.Image) return bytes;
        return contentType.ToLowerInvariant() switch
        {
            "image/jpeg" => StripJpegAppMetadata(bytes),
            "image/png" => StripPngMetadata(bytes),
            "image/webp" => StripWebpMetadata(bytes),
            _ => bytes
        };
    }

    /// <summary>
    /// Drops PNG ancillary chunks that can carry location or personal text (eXIf, tEXt, iTXt, zTXt, tIME); keeps
    /// the picture chunks untouched. Anything malformed is returned as uploaded (validation already passed).
    /// </summary>
    internal static byte[] StripPngMetadata(byte[] bytes)
    {
        if (bytes.Length < 8) return bytes;
        using var output = new MemoryStream(bytes.Length);
        output.Write(bytes, 0, 8);
        var index = 8;
        while (index + 12 <= bytes.Length)
        {
            var length = (bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3];
            if (length < 0 || index + 12 + (long)length > bytes.Length) return bytes;
            var type = Encoding.ASCII.GetString(bytes, index + 4, 4);
            var drop = type is "eXIf" or "tEXt" or "iTXt" or "zTXt" or "tIME";
            if (!drop) output.Write(bytes, index, length + 12);
            index += length + 12;
            if (type == "IEND") break;
        }
        return output.ToArray();
    }

    /// <summary>Drops the EXIF and XMP chunks of a WebP (RIFF) file and fixes the RIFF size.</summary>
    internal static byte[] StripWebpMetadata(byte[] bytes)
    {
        if (bytes.Length < 12) return bytes;
        using var body = new MemoryStream(bytes.Length);
        var index = 12;
        while (index + 8 <= bytes.Length)
        {
            var type = Encoding.ASCII.GetString(bytes, index, 4);
            var size = bytes[index + 4] | (bytes[index + 5] << 8) | (bytes[index + 6] << 16) | (bytes[index + 7] << 24);
            var padded = size + (size & 1);
            if (size < 0 || index + 8 + (long)padded > bytes.Length) return bytes;
            if (type is not ("EXIF" or "XMP ")) body.Write(bytes, index, 8 + padded);
            index += 8 + padded;
        }
        var chunks = body.ToArray();
        // VP8X flags byte (first byte of its payload): clear the EXIF (0x08) and XMP (0x04) bits for what was removed.
        if (chunks.Length >= 9 && Encoding.ASCII.GetString(chunks, 0, 4) == "VP8X") chunks[8] = (byte)(chunks[8] & ~0x0C);
        var riffSize = 4 + chunks.Length;
        var output = new byte[8 + riffSize];
        Encoding.ASCII.GetBytes("RIFF").CopyTo(output, 0);
        BitConverter.GetBytes(riffSize).CopyTo(output, 4);
        Encoding.ASCII.GetBytes("WEBP").CopyTo(output, 8);
        chunks.CopyTo(output, 12);
        return output;
    }

    private static bool LooksLikeIsoBaseMedia(byte[] bytes)
    {
        if (bytes.Length < 12) return false;
        for (var i = 0; i <= Math.Min(bytes.Length - 4, 32); i++)
        {
            if (bytes[i] == 0x66 && bytes[i + 1] == 0x74 && bytes[i + 2] == 0x79 && bytes[i + 3] == 0x70)
                return true;
        }
        return false;
    }

    private static byte[] StripJpegAppMetadata(byte[] bytes)
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
