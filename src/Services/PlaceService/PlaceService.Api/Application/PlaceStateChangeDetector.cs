using PlaceService.Api.Domain;

namespace PlaceService.Api.Application;

/// <summary>
/// D-038: decides whether a new signal changed the live state people see for a place - the dominant type and value the
/// <see cref="ICurrentPlaceStateCalculator"/> returns - by comparing the state with and without that signal. Only a real
/// change is worth telling watchers about; a fourth "Kalabalık" on a busy place is not news. Pure.
/// </summary>
public sealed class PlaceStateChangeDetector
{
    private readonly ICurrentPlaceStateCalculator _calculator;

    public PlaceStateChangeDetector(ICurrentPlaceStateCalculator calculator) => _calculator = calculator;

    /// <returns>The new state when the signal changed it, otherwise null.</returns>
    public CurrentPlaceStateDto? Detect(IReadOnlyList<PlaceSignalDocument> activeSignals, Guid newPostId, DateTime nowUtc)
    {
        if (!activeSignals.Any(s => s.PostId == newPostId)) return null;
        var after = _calculator.Calculate(activeSignals, nowUtc);
        if (after.SignalType is null) return null;
        var before = _calculator.Calculate(activeSignals.Where(s => s.PostId != newPostId).ToList(), nowUtc);
        // Values compare case-insensitively: "Busy" (app) and "BUSY" (older clients) are the same state, not news.
        var changed = before.SignalType != after.SignalType
                      || !string.Equals(before.SignalValue, after.SignalValue, StringComparison.OrdinalIgnoreCase);
        return changed ? after : null;
    }
}
