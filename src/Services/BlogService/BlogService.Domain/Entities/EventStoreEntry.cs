namespace BlogService.Domain.Entities
{
    public class EventStoreEntry
    {
        public Guid AggregateId { get; set; }
        public int Version { get; set; }
        public string EventType { get; set; }
        public string EventData { get; set; } 
        public DateTime CreatedAtUtc { get; set; }
    }
}
