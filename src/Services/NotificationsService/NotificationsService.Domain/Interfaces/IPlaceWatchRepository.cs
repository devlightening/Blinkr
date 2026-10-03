using NotificationsService.Domain.Entities;

namespace NotificationsService.Domain.Interfaces;

/// <summary>Storage for "Haber ver" watches (D-038).</summary>
public interface IPlaceWatchRepository
{
    /// <summary>This person's unexpired watches, newest first.</summary>
    Task<IReadOnlyList<PlaceWatch>> ListForUserAsync(Guid userId, DateTime nowUtc, CancellationToken ct);

    Task<int> CountActiveAsync(Guid userId, DateTime nowUtc, CancellationToken ct);

    /// <summary>One watch per person and place: a new condition replaces the old one and restarts its lifetime.</summary>
    Task<PlaceWatch> UpsertAsync(PlaceWatch watch, CancellationToken ct);

    Task<bool> RemoveAsync(Guid userId, Guid placeId, CancellationToken ct);

    /// <summary>Unexpired watches on a place, as candidates for a new state.</summary>
    Task<IReadOnlyList<PlaceWatch>> ListForPlaceAsync(Guid placeId, DateTime nowUtc, CancellationToken ct);

    /// <summary>
    /// Deletes the watch if it still exists and says whether this caller removed it. Only the caller that removed it
    /// notifies, so a repeated event or two consumers racing can never send the same notice twice.
    /// </summary>
    Task<bool> TryConsumeAsync(string watchId, CancellationToken ct);

    /// <summary>Account deletion.</summary>
    Task DeleteForUserAsync(Guid userId, CancellationToken ct);
}
