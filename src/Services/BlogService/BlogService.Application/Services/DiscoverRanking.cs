namespace BlogService.Application.Services;

/// <summary>
/// Ranking for the "Yakınımda" feed (sinyal-mvp-plan Faz 7, 10_SIGNAL_ENGINE sıralama). Freshness matters most
/// ("Freshness over volume", kök CLAUDE.md §2.1), then distance, then a small, logarithmic engagement nudge so a
/// popular old post can never outrank a fresh nearby one. Diversity keeps one person from filling the feed.
/// </summary>
public static class DiscoverRanking
{
    public static readonly TimeSpan FreshnessHalfLife = TimeSpan.FromMinutes(90);
    public const int MaxPerAuthorPerPage = 2;

    public sealed record Candidate(Guid PostId, Guid AuthorId, bool Anonymous, DateTime CreatedAtUtc, double DistanceMeters, int LikeCount, int CommentCount);

    public static double Score(Candidate c, DateTime nowUtc)
    {
        var ageMinutes = Math.Max(0, (nowUtc - c.CreatedAtUtc).TotalMinutes);
        var freshness = Math.Pow(0.5, ageMinutes / FreshnessHalfLife.TotalMinutes);
        var proximity = 1.0 / (1.0 + Math.Max(0, c.DistanceMeters) / 1000.0);
        var engagement = 1.0 + 0.25 * Math.Log(1 + Math.Max(0, c.LikeCount) + 2.0 * Math.Max(0, c.CommentCount));
        return freshness * proximity * engagement;
    }

    /// <summary>Best first; no more than <see cref="MaxPerAuthorPerPage"/> from one person in each page-sized window.</summary>
    public static List<Candidate> Order(IEnumerable<Candidate> candidates, DateTime nowUtc, int pageSize)
    {
        var ranked = candidates.OrderByDescending(c => Score(c, nowUtc)).ThenByDescending(c => c.CreatedAtUtc).ToList();
        var result = new List<Candidate>(ranked.Count);
        var deferred = new List<Candidate>();
        var perAuthor = new Dictionary<Guid, int>();
        foreach (var c in ranked)
        {
            if (result.Count > 0 && result.Count % Math.Max(1, pageSize) == 0) perAuthor.Clear();
            // Anonymous posts never group by author: that would reveal they share one.
            var key = c.Anonymous ? c.PostId : c.AuthorId;
            perAuthor.TryGetValue(key, out var seen);
            if (seen >= MaxPerAuthorPerPage) { deferred.Add(c); continue; }
            perAuthor[key] = seen + 1;
            result.Add(c);
        }
        result.AddRange(deferred);
        return result;
    }

    /// <summary>Distances are shown coarsely so a feed item never pinpoints anyone (rounded to 50 m, at least 50 m).</summary>
    public static int CoarseDistance(double meters) => Math.Max(50, (int)(Math.Round(Math.Max(0, meters) / 50.0) * 50));
}
