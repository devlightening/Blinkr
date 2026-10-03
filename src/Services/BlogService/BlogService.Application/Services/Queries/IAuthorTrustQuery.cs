namespace BlogService.Application.Services.Queries;

/// <summary>
/// Design doc P6: "Konumda doğrulanmış 23 sinyal · 9 yer" on a profile. A reliability line, not a score: how many of the
/// author's signals the server published as VERIFIED_LIVE, and at how many distinct places. Anonymous signals never
/// count (a changing number would give an anonymous post away) and no place names are returned, only the count.
/// </summary>
public interface IAuthorTrustQuery
{
    Task<AuthorTrustStats> GetAsync(Guid authorId, CancellationToken cancellationToken = default);
}

public sealed record AuthorTrustStats(int VerifiedSignals, int VerifiedPlaces);
