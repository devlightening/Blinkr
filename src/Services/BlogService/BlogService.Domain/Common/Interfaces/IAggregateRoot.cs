namespace BlogService.Domain.Common.Interfaces
{
    public interface IAggregateRoot
    {
        Guid Id { get; }
        int Version { get; }

        IReadOnlyList<IDomainEvent> GetUncommittedEvents();

        void ApplyEvent(IDomainEvent @event, int version);

        void MarkEventsAsCommitted();

        void LoadFromHistory(IEnumerable<IDomainEvent> history);
    }
}
