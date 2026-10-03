using PlaceService.Api.Domain;

namespace PlaceService.Api.Application;

/// <summary>
/// "Yer özellikleri" (D-040): what people who were verifiably at a place say about it, weighted by how recently they
/// said it. Unlike a review site, knowledge fades: a vote's weight halves every <see cref="HalfLife"/>, an attribute
/// nobody confirmed for <see cref="FadingAfter"/> is marked fading, and after <see cref="ForgottenAfter"/> it is not
/// shown at all. Explainable by design: every result carries how many people and when it was last confirmed. Pure.
/// </summary>
public sealed class PlaceAttributeCalculator
{
    public static readonly TimeSpan HalfLife = TimeSpan.FromDays(30);
    public static readonly TimeSpan FadingAfter = TimeSpan.FromDays(60);
    public static readonly TimeSpan ForgottenAfter = TimeSpan.FromDays(180);

    /// <summary>Share of (weighted) "yes" needed to say yes; at or below 1 - this it is "no", in between "mixed".</summary>
    public const double Agreement = 0.66;

    public IReadOnlyList<PlaceAttributeDto> Calculate(IReadOnlyList<PlaceAttributeVoteDocument> votes, Guid? viewerId, DateTime nowUtc)
    {
        return votes
            .Where(v => nowUtc - v.VotedAtUtc <= ForgottenAfter)
            .GroupBy(v => v.Key)
            .Where(g => PlaceAttributeVoteDocument.Keys.Contains(g.Key))
            .Select(g =>
            {
                double yes = 0, no = 0;
                foreach (var v in g)
                {
                    var weight = Math.Pow(0.5, (nowUtc - v.VotedAtUtc).TotalDays / HalfLife.TotalDays);
                    if (v.Value) yes += weight; else no += weight;
                }
                var share = yes + no <= 0 ? 0.5 : yes / (yes + no);
                var state = share >= Agreement ? "yes" : share <= 1 - Agreement ? "no" : "mixed";
                var last = g.Max(v => v.VotedAtUtc);
                var mine = viewerId.HasValue ? g.FirstOrDefault(v => v.UserId == viewerId.Value) : null;
                return new PlaceAttributeDto(g.Key, state, g.Select(v => v.UserId).Distinct().Count(), last, nowUtc - last > FadingAfter, mine?.Value);
            })
            .OrderBy(a => Array.IndexOf(PlaceAttributeVoteDocument.Keys.ToArray(), a.Key))
            .ToList();
    }
}

/// <param name="State">yes | no | mixed (people disagree, recently weighted).</param>
/// <param name="Voters">How many different people said something (never who).</param>
/// <param name="Fading">Nobody confirmed it for a while: shown dimmed, "teyit gerekiyor".</param>
/// <param name="MyVote">The caller's own answer, if any.</param>
public sealed record PlaceAttributeDto(string Key, string State, int Voters, DateTime LastConfirmedAtUtc, bool Fading, bool? MyVote);

/// <param name="CanVote">The caller has a server-verified (VERIFIED_LIVE) signal at this place in the last 30 days.</param>
public sealed record PlaceAttributesResponse(IReadOnlyList<PlaceAttributeDto> Attributes, bool CanVote, IReadOnlyList<string> Catalog);
