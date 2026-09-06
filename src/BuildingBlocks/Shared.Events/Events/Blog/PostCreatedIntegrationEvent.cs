using Shared.Events.Abstractions;
using Shared.Events.Concretes;


namespace Shared.Events.Events.Blog
{
    public sealed class PostCreatedIntegrationEvent : IntegrationEvent
    {
        public Guid PostId { get; set; }
        public Guid AuthorId { get; set; }
        public string? Title { get; set; }
        public string? Content { get; set; }
        public string? AuthorName { get; set; }
        public string? AuthorGender { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public double? AccuracyMeters { get; set; }
        public string? LocationName { get; set; }
        public Guid? PlaceId { get; set; }
        public string? SignalType { get; set; }
        public string? SignalValue { get; set; }
        public string? AudienceType { get; set; }
        public string? IdentityDisclosure { get; set; }
        public string? LocationPrecision { get; set; }
        public string? SourceType { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public ICollection<PostMediaDto>? Media { get; set; }
    }

    public class PostMediaDto
    {
        public Guid? MediaId { get; set; }
        public string? Url { get; set; }
        public string? MediaType { get; set; }
        public string? ContentType { get; set; }
        public long? SizeBytes { get; set; }
        public int? Width { get; set; }
        public int? Height { get; set; }
        public double? DurationSeconds { get; set; }
        public string? ThumbnailUrl { get; set; }
    }
}
