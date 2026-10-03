using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;
using PlaceService.Api.Domain;

namespace PlaceService.Api.Infrastructure;

/// <summary>Storage for "Yere sor" questions (D-039).</summary>
public interface IPlaceQuestionRepository
{
    /// <summary>Joins the open question for this place and kind, or opens one. Returns the question as stored.</summary>
    Task<PlaceQuestionDocument> AskAsync(PlaceDocument place, string kind, Guid askerId, DateTime nowUtc, CancellationToken ct);
    /// <summary>Removes me from an open question; a question nobody waits for any more is deleted.</summary>
    Task WithdrawAsync(Guid placeId, string kind, Guid askerId, DateTime nowUtc, CancellationToken ct);
    Task<int> CountOpenForAskerAsync(Guid askerId, DateTime nowUtc, CancellationToken ct);
    /// <summary>Unexpired questions of a place: open ones and answered ones (so the asker sees the answer).</summary>
    Task<IReadOnlyList<PlaceQuestionDocument>> ListForPlaceAsync(Guid placeId, DateTime nowUtc, CancellationToken ct);
    Task<IReadOnlyList<PlaceQuestionDocument>> ListOpenNearAsync(double lat, double lon, int radiusMeters, int limit, DateTime nowUtc, CancellationToken ct);
    /// <summary>
    /// Marks the open question of this kind answered by this post (atomic: one answer wins). Also returns a question this
    /// same post already answered, so a redelivered event can republish; null when there is nothing to answer.
    /// </summary>
    Task<PlaceQuestionDocument?> TryAnswerAsync(Guid placeId, string kind, Guid postId, string? value, DateTime nowUtc, CancellationToken ct);
    Task EnsureIndexesAsync(CancellationToken ct);
}

public sealed class PlaceQuestionRepository : IPlaceQuestionRepository
{
    private readonly IMongoCollection<PlaceQuestionDocument> _questions;

    public PlaceQuestionRepository(IMongoDatabase database) => _questions = database.GetCollection<PlaceQuestionDocument>("place_questions");

    private static FilterDefinitionBuilder<PlaceQuestionDocument> F => Builders<PlaceQuestionDocument>.Filter;

    private static FilterDefinition<PlaceQuestionDocument> OpenFor(Guid placeId, string kind, DateTime nowUtc) =>
        F.Eq(q => q.PlaceId, placeId) & F.Eq(q => q.Kind, kind) & F.Eq(q => q.Status, PlaceQuestionDocument.StatusOpen) & F.Gt(q => q.ExpiresAtUtc, nowUtc);

    public async Task<PlaceQuestionDocument> AskAsync(PlaceDocument place, string kind, Guid askerId, DateTime nowUtc, CancellationToken ct)
    {
        var joined = await _questions.FindOneAndUpdateAsync(
            OpenFor(place.Id, kind, nowUtc),
            Builders<PlaceQuestionDocument>.Update.AddToSet(q => q.AskerIds, askerId),
            new FindOneAndUpdateOptions<PlaceQuestionDocument> { ReturnDocument = ReturnDocument.After }, ct);
        if (joined is not null) return joined;

        // The TTL monitor runs about once a minute: an expired, never-answered question may still hold the "one open
        // question per place and kind" slot. It is over anyway; clear it so the new one can open.
        await _questions.DeleteManyAsync(
            F.Eq(q => q.PlaceId, place.Id) & F.Eq(q => q.Kind, kind) & F.Eq(q => q.Status, PlaceQuestionDocument.StatusOpen) & F.Lte(q => q.ExpiresAtUtc, nowUtc), ct);

        var question = new PlaceQuestionDocument
        {
            Id = Guid.NewGuid(),
            PlaceId = place.Id,
            PlaceName = place.Name,
            PlaceCategory = place.Category,
            Location = place.Location,
            Kind = kind,
            AskerIds = new List<Guid> { askerId },
            CreatedAtUtc = nowUtc,
            ExpiresAtUtc = nowUtc + PlaceQuestionDocument.Lifetime,
        };
        try
        {
            await _questions.InsertOneAsync(question, cancellationToken: ct);
            return question;
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            // Someone opened the same question a moment earlier: join theirs.
            return await _questions.FindOneAndUpdateAsync(
                OpenFor(place.Id, kind, nowUtc),
                Builders<PlaceQuestionDocument>.Update.AddToSet(q => q.AskerIds, askerId),
                new FindOneAndUpdateOptions<PlaceQuestionDocument> { ReturnDocument = ReturnDocument.After }, ct) ?? question;
        }
    }

    public async Task WithdrawAsync(Guid placeId, string kind, Guid askerId, DateTime nowUtc, CancellationToken ct)
    {
        var open = OpenFor(placeId, kind, nowUtc);
        await _questions.UpdateOneAsync(open, Builders<PlaceQuestionDocument>.Update.Pull(q => q.AskerIds, askerId), cancellationToken: ct);
        await _questions.DeleteOneAsync(open & F.Size(q => q.AskerIds, 0), ct);
    }

    public async Task<int> CountOpenForAskerAsync(Guid askerId, DateTime nowUtc, CancellationToken ct) =>
        (int)await _questions.CountDocumentsAsync(
            F.AnyEq(q => q.AskerIds, askerId) & F.Eq(q => q.Status, PlaceQuestionDocument.StatusOpen) & F.Gt(q => q.ExpiresAtUtc, nowUtc),
            cancellationToken: ct);

    public async Task<IReadOnlyList<PlaceQuestionDocument>> ListForPlaceAsync(Guid placeId, DateTime nowUtc, CancellationToken ct) =>
        await _questions.Find(F.Eq(q => q.PlaceId, placeId) & F.Gt(q => q.ExpiresAtUtc, nowUtc)).SortByDescending(q => q.CreatedAtUtc).Limit(10).ToListAsync(ct);

    public async Task<IReadOnlyList<PlaceQuestionDocument>> ListOpenNearAsync(double lat, double lon, int radiusMeters, int limit, DateTime nowUtc, CancellationToken ct)
    {
        var point = GeoJson.Point(GeoJson.Geographic(lon, lat));
        var filter = F.NearSphere(q => q.Location, point, maxDistance: radiusMeters)
                     & F.Eq(q => q.Status, PlaceQuestionDocument.StatusOpen)
                     & F.Gt(q => q.ExpiresAtUtc, nowUtc);
        return await _questions.Find(filter).Limit(limit).ToListAsync(ct);
    }

    public async Task<PlaceQuestionDocument?> TryAnswerAsync(Guid placeId, string kind, Guid postId, string? value, DateTime nowUtc, CancellationToken ct)
    {
        var answered = await _questions.FindOneAndUpdateAsync(
            OpenFor(placeId, kind, nowUtc),
            Builders<PlaceQuestionDocument>.Update
                .Set(q => q.Status, PlaceQuestionDocument.StatusAnswered)
                .Set(q => q.AnsweredByPostId, postId)
                .Set(q => q.AnswerValue, value)
                .Set(q => q.AnsweredAtUtc, nowUtc),
            new FindOneAndUpdateOptions<PlaceQuestionDocument> { ReturnDocument = ReturnDocument.After }, ct);
        return answered ?? await _questions.Find(F.Eq(q => q.AnsweredByPostId, postId)).FirstOrDefaultAsync(ct);
    }

    public async Task EnsureIndexesAsync(CancellationToken ct)
    {
        var keys = Builders<PlaceQuestionDocument>.IndexKeys;
        await _questions.Indexes.CreateManyAsync(new[]
        {
            new CreateIndexModel<PlaceQuestionDocument>(keys.Geo2DSphere(q => q.Location), new CreateIndexOptions { Name = "ix_place_questions_location" }),
            new CreateIndexModel<PlaceQuestionDocument>(keys.Ascending(q => q.PlaceId).Ascending(q => q.Kind).Ascending(q => q.Status), new CreateIndexOptions<PlaceQuestionDocument>
            {
                Name = "ux_place_questions_open",
                Unique = true,
                // Only one OPEN question per place and kind; answered ones may pile up until they expire.
                PartialFilterExpression = F.Eq(q => q.Status, PlaceQuestionDocument.StatusOpen),
            }),
            new CreateIndexModel<PlaceQuestionDocument>(keys.Ascending(q => q.AskerIds), new CreateIndexOptions { Name = "ix_place_questions_askers" }),
            new CreateIndexModel<PlaceQuestionDocument>(keys.Ascending(q => q.AnsweredByPostId), new CreateIndexOptions { Name = "ix_place_questions_answer", Sparse = true }),
            new CreateIndexModel<PlaceQuestionDocument>(keys.Ascending(q => q.ExpiresAtUtc), new CreateIndexOptions { Name = "ttl_place_questions", ExpireAfter = TimeSpan.Zero }),
        }, ct);
    }
}
