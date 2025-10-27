namespace BlogService.Api.Services;

public record PresignedUpload(string UploadUrl, DateTimeOffset ExpiresAt, string PublicUrl, IDictionary<string, string> RequiredHeaders);

public interface IObjectStorage
{
    Task<PresignedUpload> GetPresignedPutAsync(string key, string contentType, long maxBytes, TimeSpan ttl);
}
