namespace BlogService.Application.Services;

public interface IMediaAttachmentService
{
    Task<MediaUploadAuthorization> CreateUploadAsync(Guid ownerUserId, CreateMediaUploadRequest request, CancellationToken ct);
    Task MarkUploadedAsync(Guid ownerUserId, Guid mediaId, Stream content, string contentType, CancellationToken ct);
    Task<MediaUploadAuthorization?> GetUploadAsync(Guid ownerUserId, Guid mediaId, CancellationToken ct);
    Task<IReadOnlyList<AttachedMedia>> ClaimForPostAsync(Guid ownerUserId, Guid postId, IReadOnlyCollection<Guid> mediaIds, CancellationToken ct);
    Task<int> MarkExpiredOrphansAsync(TimeSpan olderThan, CancellationToken ct);
}

