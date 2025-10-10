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
      
    }
}
