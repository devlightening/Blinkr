using BlogService.Domain.Common.Interfaces;

public interface IEventStoreRepository
{
    Task<T> LoadAsync<T>(Guid aggregateId, CancellationToken cancellationToken) where T : IAggregateRoot, new();
    Task SaveAsync(IAggregateRoot aggregate, CancellationToken cancellationToken);
}
