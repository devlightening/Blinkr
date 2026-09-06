using BlogService.Domain.Enums;

namespace BlogService.Application.Services;

public sealed record CreateMediaUploadRequest(
    string FileName,
    string ContentType,
    long SizeBytes,
    int? Width = null,
    int? Height = null,
    double? DurationSeconds = null);

public sealed record MediaUploadAuthorization(
    Guid MediaId,
    string UploadUrl,
    DateTimeOffset ExpiresAt,
    string PublicUrl,
    Dictionary<string, string> RequiredHeaders);

public sealed record FinalizeMediaUploadRequest(
    long SizeBytes,
    string ContentType,
    int? Width = null,
    int? Height = null,
    double? DurationSeconds = null);

public sealed record AttachedMedia(
    Guid MediaId,
    string Url,
    MediaType MediaType,
    string ContentType,
    long SizeBytes,
    int? Width,
    int? Height,
    double? DurationSeconds,
    string? ThumbnailUrl);

