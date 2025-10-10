using Shared.Events.Concretes;

namespace Shared.Events.Events.Blog
{
    public sealed class PostDeletedIntegrationEvent : IntegrationEvent
    {
        public Guid PostId { get; set; }
    }
}
