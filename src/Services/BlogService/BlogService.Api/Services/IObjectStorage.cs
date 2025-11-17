namespace BlogService.Api.Services;

/// <summary>
/// Object storage abstraction for file uploads and management
/// TODO: Move to BlogService.Application.Services for proper Onion Architecture
/// </summary>
public interface IObjectStorage
{
    /// <summary>
    /// Generate a presigned URL for uploading a file
    /// </summary>
    /// <param name="key">Object key/path</param>
    /// <param name="contentType">MIME content type</param>
    /// <param name="maxBytes">Maximum file size in bytes</param>
    /// <param name="ttl">Time to live for the presigned URL</param>
    /// <returns>Presigned upload information</returns>
    Task<PresignedUpload> GetPresignedPutAsync(string key, string contentType, long maxBytes, TimeSpan ttl);
}

/// <summary>
/// Presigned upload information
/// </summary>
/// <param name="UploadUrl">URL for uploading the file</param>
/// <param name="ExpiresAt">When the URL expires</param>
/// <param name="PublicUrl">Public URL to access the uploaded file</param>
/// <param name="RequiredHeaders">Headers required for the upload</param>
public record PresignedUpload(
    string UploadUrl,
    DateTimeOffset ExpiresAt,
    string PublicUrl,
    Dictionary<string, string> RequiredHeaders
);
