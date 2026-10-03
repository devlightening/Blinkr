using BlogService.Application.Services.Queries;
using BlogService.Infrastructure.ReadModels;
using MongoDB.Driver;

namespace BlogService.Infrastructure.Services;

/// <summary>
/// Reads <see cref="AuthorTrustStats"/> from the "posts" read model. Deleted signals are gone from it and moderated ones
/// were moved to "posts_moderated", so neither counts. Expired signals still count: they were verified when published.
/// </summary>
public sealed class MongoAuthorTrustQuery : IAuthorTrustQuery
{
    public const string VerifiedLive = "VERIFIED_LIVE";
    private readonly IMongoCollection<PostDocument> _posts;

    public MongoAuthorTrustQuery(IMongoDatabase db) => _posts = db.GetCollection<PostDocument>("posts");

    public async Task<AuthorTrustStats> GetAsync(Guid authorId, CancellationToken cancellationToken = default)
    {
        // Never anonymous, whoever asks (the author too): AuthorPostFilters with includeAnonymous = false.
        var filter = AuthorPostFilters.ForAuthor(authorId, includeAnonymous: false)
                     & Builders<PostDocument>.Filter.Eq(p => p.PublicationTrust, VerifiedLive);

        var signals = (int)await _posts.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        if (signals == 0) return new AuthorTrustStats(0, 0);

        var withPlace = filter & Builders<PostDocument>.Filter.Ne(p => p.PlaceId, null);
        var places = await (await _posts.DistinctAsync(p => p.PlaceId, withPlace, cancellationToken: cancellationToken)).ToListAsync(cancellationToken);
        return new AuthorTrustStats(signals, places.Count(id => id.HasValue));
    }
}
