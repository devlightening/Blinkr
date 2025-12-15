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
        public ICollection<PostMediaDto>? Media { get; set; }
    }

    public class PostMediaDto
    {
        public string? Url { get; set; }
        public string? MediaType { get; set; }
    }
}
