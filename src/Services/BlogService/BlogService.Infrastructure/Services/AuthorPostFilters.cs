using BlogService.Infrastructure.ReadModels;
using MongoDB.Driver;

namespace BlogService.Infrastructure.Services;

/// <summary>
/// Filters for "posts by this author". Posts published with AnonymousMap must not be attributable to
/// their author by anyone else (product constitution 10.3): listing by author id would otherwise
/// reveal which anonymous posts belong to whom even though each post hides its author id.
/// </summary>
public static class AuthorPostFilters
{
    public const string AnonymousDisclosure = "AnonymousMap";

    /// <param name="includeAnonymous">True only when the caller is the author.</param>
    public static FilterDefinition<PostDocument> ForAuthor(Guid authorId, bool includeAnonymous)
    {
        var builder = Builders<PostDocument>.Filter;
        var byAuthor = builder.Eq(p => p.AuthorId, authorId);
        // $ne also matches legacy documents that have no IdentityDisclosure, which are not anonymous.
        return includeAnonymous ? byAuthor : byAuthor & builder.Ne(p => p.IdentityDisclosure, AnonymousDisclosure);
    }
}
