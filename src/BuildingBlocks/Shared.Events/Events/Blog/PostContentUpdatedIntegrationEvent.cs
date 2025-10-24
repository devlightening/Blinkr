using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog
{
    public sealed class PostContentUpdatedIntegrationEvent : IntegrationEvent
    {
        public Guid PostId { get; set; }
        public string? NewTitle { get; set; }
        public string? NewContent { get; set; }

       
    }
}
