using Amazon.S3;
using Amazon.S3.Model;

namespace BlogService.Api.Services;

/// <summary>
/// AWS S3 implementation of object storage
/// TODO: Move to BlogService.Infrastructure.Services for proper Onion Architecture
/// </summary>
public sealed class S3Storage : IObjectStorage
{
    private readonly IAmazonS3 _s3;
    private readonly string _bucket;
    private readonly ILogger<S3Storage> _logger;

    public S3Storage(IAmazonS3 s3, string bucket, ILogger<S3Storage> logger)
    {
        _s3 = s3;
        _bucket = bucket;
        _logger = logger;
    }

    public Task<PresignedUpload> GetPresignedPutAsync(string key, string contentType, long maxBytes, TimeSpan ttl)
    {
        try
        {
            var request = new GetPreSignedUrlRequest
            {
                BucketName = _bucket,
                Key = key,
                Verb = HttpVerb.PUT,
                Expires = DateTime.UtcNow.Add(ttl),
                ContentType = contentType,
                ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
            };

            var url = _s3.GetPreSignedURL(request);
            var publicUrl = $"https://{_bucket}.s3.amazonaws.com/{key}";

            _logger.LogInformation("Generated presigned URL for key: {Key}, expires: {ExpiresAt}", key, DateTime.UtcNow.Add(ttl));

            return Task.FromResult(new PresignedUpload(
                UploadUrl: url,
                ExpiresAt: DateTimeOffset.UtcNow.Add(ttl),
                PublicUrl: publicUrl,
                RequiredHeaders: new Dictionary<string, string> 
                { 
                    ["Content-Type"] = contentType,
                    ["x-amz-server-side-encryption"] = "AES256"
                }
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate presigned URL for key: {Key}", key);
            throw;
        }
    }
}
