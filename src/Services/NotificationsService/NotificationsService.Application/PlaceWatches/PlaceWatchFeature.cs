using MediatR;
using NotificationsService.Domain.Entities;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.PlaceWatches;

/// <summary>What the watcher sees about their own watch (D-038). Never returned for anyone else.</summary>
public sealed record PlaceWatchDto(Guid PlaceId, string PlaceName, string Condition, DateTime CreatedAtUtc, DateTime ExpiresAtUtc);

public sealed record ListPlaceWatchesQuery(Guid UserId) : IRequest<IReadOnlyList<PlaceWatchDto>>;

/// <summary>Start (or change) watching a place for a condition: calm | open | update.</summary>
public sealed record WatchPlaceCommand(Guid UserId, Guid PlaceId, string? PlaceName, string? Condition) : IRequest<PlaceWatchDto>;

public sealed record UnwatchPlaceCommand(Guid UserId, Guid PlaceId) : IRequest<bool>;

/// <summary>Expected watch failures; the API maps them to 400 / 409 with a code.</summary>
public sealed class PlaceWatchException : Exception
{
    public const string InvalidCode = "WATCH_INVALID";
    public const string LimitCode = "WATCH_LIMIT";

    public string Code { get; }
    public bool IsLimit => Code == LimitCode;

    public PlaceWatchException(string code, string message) : base(message) => Code = code;
}

internal static class PlaceWatchMapping
{
    public static PlaceWatchDto ToDto(this PlaceWatch w) => new(w.PlaceId, w.PlaceName, w.Condition, w.CreatedAtUtc, w.ExpiresAtUtc);
}

public sealed class ListPlaceWatchesHandler : IRequestHandler<ListPlaceWatchesQuery, IReadOnlyList<PlaceWatchDto>>
{
    private readonly IPlaceWatchRepository _watches;
    public ListPlaceWatchesHandler(IPlaceWatchRepository watches) => _watches = watches;

    public async Task<IReadOnlyList<PlaceWatchDto>> Handle(ListPlaceWatchesQuery q, CancellationToken ct) =>
        (await _watches.ListForUserAsync(q.UserId, DateTime.UtcNow, ct)).Select(w => w.ToDto()).ToList();
}

/// <summary>At most <see cref="PlaceWatch.MaxActive"/> places at a time; changing an existing watch does not count twice.</summary>
public sealed class WatchPlaceHandler : IRequestHandler<WatchPlaceCommand, PlaceWatchDto>
{
    private readonly IPlaceWatchRepository _watches;
    public WatchPlaceHandler(IPlaceWatchRepository watches) => _watches = watches;

    public async Task<PlaceWatchDto> Handle(WatchPlaceCommand req, CancellationToken ct)
    {
        var condition = req.Condition?.Trim().ToLowerInvariant() ?? PlaceWatch.Calm;
        if (req.PlaceId == Guid.Empty || string.IsNullOrWhiteSpace(req.PlaceName) || !PlaceWatch.Conditions.Contains(condition))
            throw new PlaceWatchException(PlaceWatchException.InvalidCode, "Yer ya da koşul geçersiz.");

        var now = DateTime.UtcNow;
        var mine = await _watches.ListForUserAsync(req.UserId, now, ct);
        if (mine.All(w => w.PlaceId != req.PlaceId) && mine.Count >= PlaceWatch.MaxActive)
            throw new PlaceWatchException(PlaceWatchException.LimitCode, $"Aynı anda en fazla {PlaceWatch.MaxActive} yeri izleyebilirsin.");

        var saved = await _watches.UpsertAsync(PlaceWatch.Create(req.UserId, req.PlaceId, req.PlaceName, condition, now), ct);
        return saved.ToDto();
    }
}

public sealed class UnwatchPlaceHandler : IRequestHandler<UnwatchPlaceCommand, bool>
{
    private readonly IPlaceWatchRepository _watches;
    public UnwatchPlaceHandler(IPlaceWatchRepository watches) => _watches = watches;

    public Task<bool> Handle(UnwatchPlaceCommand req, CancellationToken ct) => _watches.RemoveAsync(req.UserId, req.PlaceId, ct);
}
