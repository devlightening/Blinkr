using PlaceService.Api.Domain;

namespace PlaceService.Api.Application;

public interface ICurrentPlaceStateCalculator
{
    CurrentPlaceStateDto Calculate(IReadOnlyList<PlaceSignalDocument> activeSignals, DateTime nowUtc);
}

public sealed class CurrentPlaceStateCalculator : ICurrentPlaceStateCalculator
{
    public CurrentPlaceStateDto Calculate(IReadOnlyList<PlaceSignalDocument> activeSignals, DateTime nowUtc)
    {
        var valid = activeSignals
            .Where(s => !s.ExpiresAtUtc.HasValue || s.ExpiresAtUtc > nowUtc)
            .OrderByDescending(s => s.CreatedAtUtc)
            .Take(20)
            .ToList();

        if (valid.Count == 0)
            return new CurrentPlaceStateDto(null, null, "NONE", null, null, "LOW", 0, 0);

        var grouped = valid
            .GroupBy(s => $"{s.SignalType}:{s.SignalValue ?? s.Title ?? s.Text}")
            .Select(g =>
            {
                var score = g.Sum(s => FreshnessWeight(s.CreatedAtUtc, nowUtc));
                var latest = g.OrderByDescending(s => s.CreatedAtUtc).First();
                return new { Key = g.Key, Score = score, Latest = latest, Count = g.Count() };
            })
            .OrderByDescending(g => g.Score)
            .ThenByDescending(g => g.Latest.CreatedAtUtc)
            .First();

        var confidenceValue = Math.Min(1, (grouped.Score / 3.0) + Math.Min(0.25, valid.Count * 0.05));
        var confidence = confidenceValue >= 0.72 ? "HIGH" : confidenceValue >= 0.38 ? "MEDIUM" : "LOW";
        var newestAge = nowUtc - grouped.Latest.CreatedAtUtc;
        var freshness = newestAge <= TimeSpan.FromMinutes(30) ? "FRESH" :
            newestAge <= TimeSpan.FromHours(3) ? "RECENT" : "STALE";

        return new CurrentPlaceStateDto(
            grouped.Latest.SignalType,
            grouped.Latest.SignalValue ?? grouped.Latest.Title,
            freshness,
            grouped.Latest.CreatedAtUtc,
            grouped.Latest.ExpiresAtUtc,
            confidence,
            Math.Round(confidenceValue, 2),
            valid.Count);
    }

    private static double FreshnessWeight(DateTime createdAtUtc, DateTime nowUtc)
    {
        var age = nowUtc - createdAtUtc;
        if (age <= TimeSpan.FromMinutes(30)) return 1.0;
        if (age <= TimeSpan.FromHours(3)) return 0.65;
        if (age <= TimeSpan.FromHours(12)) return 0.35;
        return 0.15;
    }
}
