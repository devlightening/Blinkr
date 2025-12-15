namespace BlogService.Application.Services;

public interface IObjectStorage
{
    Task<PresignedUpload> GetPresignedPutAsync(string key, string contentType, long maxBytes, TimeSpan ttl);
}

public record PresignedUpload(
    string UploadUrl,
    DateTimeOffset ExpiresAt,
    string PublicUrl,
    Dictionary<string, string> RequiredHeaders
);
