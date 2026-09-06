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
        var mediaType = ResolveMediaType(request.ContentType);
        ValidateRequest(request, mediaType);

        var id = Guid.NewGuid();
        var extension = GetSafeExtension(request.ContentType);
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
            ContentType = request.ContentType,
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
            new Dictionary<string, string> { ["Content-Type"] = request.ContentType });
    }

    public async Task MarkUploadedAsync(Guid ownerUserId, Guid mediaId, Stream content, string contentType, CancellationToken ct)
    {
        var doc = await _uploads.Find(x => x.Id == mediaId).FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Media not found.");
        if (doc.OwnerUserId != ownerUserId) throw new UnauthorizedAccessException("Media belongs to another user.");
        if (doc.Status != "PENDING") throw new InvalidOperationException("Media is not waiting for upload.");
        if (doc.ExpiresAtUtc <= DateTime.UtcNow) throw new InvalidOperationException("Upload authorization expired.");
        if (!string.Equals(doc.ContentType, contentType, StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Content-Type does not match presign request.");

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

        return mediaType == MediaType.Image && contentType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase)
            ? StripJpegAppMetadata(bytes)
            : bytes;
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
