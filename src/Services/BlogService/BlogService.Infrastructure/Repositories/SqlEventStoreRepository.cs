using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Entities;
using BlogService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace BlogService.Infrastructure.Repositories
{
    public class SqlEventStoreRepository : IEventStoreRepository
    {
        private readonly BlogDbContext _context;

        public SqlEventStoreRepository(BlogDbContext context)
        {
            _context = context;
        }

        public async Task<T> LoadAsync<T>(Guid aggregateId, CancellationToken cancellationToken) where T : IAggregateRoot, new()
        {
            var events = await _context.EventStore
                .Where(x => x.AggregateId == aggregateId)
                .OrderBy(x => x.Version)
                .ToListAsync(cancellationToken);

            var aggregate = new T();

            // Deserialize preserving runtime type info based on EventType
            var domainEvents = events
                .Select(x => DeserializeDomainEvent(x.EventType, x.EventData))
                .Where(e => e is not null)!
                .ToList();

            aggregate.LoadFromHistory(domainEvents);
            return aggregate;
        }

        public async Task SaveAsync(IAggregateRoot aggregate, CancellationToken cancellationToken)
        {
            var nextVersion = aggregate.Version;
            foreach (var domainEvent in aggregate.GetUncommittedEvents())
            {
                var eventData = JsonSerializer.Serialize(domainEvent);
                var eventStoreEntry = new EventStoreEntry
                {
                    AggregateId = aggregate.Id,
                    Version = ++nextVersion,
                    EventType = domainEvent.GetType().AssemblyQualifiedName!,
                    EventData = eventData,
                    CreatedAtUtc = DateTime.UtcNow
                };

                _context.EventStore.Add(eventStoreEntry);
            }

            await _context.SaveChangesAsync(cancellationToken);
            aggregate.MarkEventsAsCommitted();
        }

        private static IDomainEvent DeserializeDomainEvent(string eventType, string eventData)
        {
            var type = Type.GetType(eventType) ?? throw new InvalidOperationException($"Unknown event type: {eventType}");
            var domainEvent = (IDomainEvent?)JsonSerializer.Deserialize(eventData, type);
            if (domainEvent is null)
                throw new InvalidOperationException($"Failed to deserialize event type: {eventType}");
            return domainEvent;
        }
    }
}
