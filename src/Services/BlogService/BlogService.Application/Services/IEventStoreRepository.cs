namespace BlogService.Application.Services;

/// <summary>
/// Event store repository interface for domain event persistence
/// </summary>
public interface IEventStoreRepository
{
    /// <summary>
    /// Append events to a stream
    /// </summary>
    /// <param name="streamName">Stream identifier</param>
    /// <param name="expectedVersion">Expected version for optimistic concurrency</param>
    /// <param name="events">Domain events to append</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task AppendAsync(string streamName, long? expectedVersion, IEnumerable<object> events, CancellationToken cancellationToken = default);
}
