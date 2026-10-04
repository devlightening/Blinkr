using System.Security.Cryptography;
using IdentityService.Api.Controllers;
using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Shared.Moderation;

namespace IdentityService.Api.Collections;

public record CollectionItemDto(Guid PlaceId, string Name, string? Category, double Latitude, double Longitude, string? Note, DateTime AddedAtUtc);
/// <param name="PlaceIds">Every place in the list (at most 50), so the app can tick the lists that already hold a place.</param>
public record CollectionSummaryDto(Guid Id, string Title, string? Description, string Visibility, string? ShareToken, int ItemCount, IReadOnlyList<CollectionItemDto> Preview, DateTime UpdatedAtUtc, IReadOnlyList<Guid> PlaceIds);
public record CollectionOwnerDto(Guid Id, string UserName, string? DisplayName, string? AvatarKey, string? PhotoVersion);
public record CollectionDetailDto(Guid Id, string Title, string? Description, string Visibility, string? ShareToken, bool IsMine, CollectionOwnerDto? Owner, IReadOnlyList<CollectionItemDto> Items, DateTime UpdatedAtUtc);

public sealed class CollectionException : Exception
{
    public const string Invalid = "COLLECTION_INVALID";
    public const string Limit = "COLLECTION_LIMIT";
    public const string ItemsLimit = "COLLECTION_ITEMS_LIMIT";
    public const string NotFound = "COLLECTION_NOT_FOUND";
    public const string Blocked = "CONTENT_BLOCKED";

    public string Code { get; }
    public CollectionException(string code, string message) : base(message) => Code = code;
}

/// <summary>
/// "Koleksiyonlar" (D-041) use cases. The owner does everything; a viewer can only read a list the owner shared by link,
/// and never when a block stands between them (answered as "not found", so the block is not revealed). Titles, notes and
/// descriptions can be shared, so they pass the same text filter as a bio (threats/hate refused, ID numbers masked).
/// </summary>
public sealed class PlaceCollectionService
{
    private readonly AppDbContext _db;

    public PlaceCollectionService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CollectionSummaryDto>> ListMineAsync(Guid me, CancellationToken ct)
    {
        var lists = await _db.PlaceCollections.Where(c => c.UserId == me).Include(c => c.Items)
            .OrderByDescending(c => c.UpdatedAtUtc).AsNoTracking().ToListAsync(ct);
        return lists.Select(c => new CollectionSummaryDto(c.Id, c.Title, c.Description, c.Visibility, c.Visibility == PlaceCollectionRules.Link ? c.ShareToken : null,
            c.Items.Count, c.Items.OrderBy(i => i.Position).Take(3).Select(ToItem).ToList(), c.UpdatedAtUtc, c.Items.Select(i => i.PlaceId).ToList())).ToList();
    }

    public async Task<CollectionDetailDto> GetMineAsync(Guid me, Guid id, CancellationToken ct) => ToDetail(await OwnedAsync(me, id, ct), me, null);

    public async Task<CollectionDetailDto> CreateAsync(Guid me, string? title, string? description, CancellationToken ct)
    {
        if (await _db.PlaceCollections.CountAsync(c => c.UserId == me, ct) >= PlaceCollectionRules.MaxPerUser)
            throw new CollectionException(CollectionException.Limit, $"En fazla {PlaceCollectionRules.MaxPerUser} koleksiyon oluşturabilirsin.");
        var collection = new PlaceCollection
        {
            UserId = me,
            Title = CleanRequired(title, PlaceCollectionRules.MaxTitleLength),
            Description = CleanOptional(description, PlaceCollectionRules.MaxDescriptionLength),
        };
        _db.PlaceCollections.Add(collection);
        await _db.SaveChangesAsync(ct);
        return ToDetail(collection, me, null);
    }

    /// <summary>Null fields stay as they are. Sharing by link issues a token once; <paramref name="newLink"/> replaces it.</summary>
    public async Task<CollectionDetailDto> UpdateAsync(Guid me, Guid id, string? title, string? description, string? visibility, bool newLink, CancellationToken ct)
    {
        var collection = await OwnedAsync(me, id, ct);
        if (title is not null) collection.Title = CleanRequired(title, PlaceCollectionRules.MaxTitleLength);
        if (description is not null) collection.Description = CleanOptional(description, PlaceCollectionRules.MaxDescriptionLength);
        if (visibility is not null)
        {
            if (!PlaceCollectionRules.IsVisibility(visibility)) throw new CollectionException(CollectionException.Invalid, "Görünürlük geçersiz.");
            collection.Visibility = visibility;
        }
        if (collection.Visibility == PlaceCollectionRules.Link && (collection.ShareToken is null || newLink)) collection.ShareToken = NewToken();
        collection.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDetail(collection, me, null);
    }

    public async Task DeleteAsync(Guid me, Guid id, CancellationToken ct)
    {
        var collection = await _db.PlaceCollections.FirstOrDefaultAsync(c => c.Id == id && c.UserId == me, ct);
        if (collection is null) return;
        _db.PlaceCollections.Remove(collection);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Adds a place to the end of the list, or updates its snapshot and note when it is already there.</summary>
    public async Task<CollectionDetailDto> PutItemAsync(Guid me, Guid id, Guid placeId, string? name, string? category, double latitude, double longitude, string? note, CancellationToken ct)
    {
        if (placeId == Guid.Empty || !SavedPlacesController.Valid(name, latitude, longitude))
            throw new CollectionException(CollectionException.Invalid, "Yer bilgisi eksik.");
        var collection = await OwnedAsync(me, id, ct);
        var item = collection.Items.FirstOrDefault(i => i.PlaceId == placeId);
        if (item is null)
        {
            if (collection.Items.Count >= PlaceCollectionRules.MaxItems)
                throw new CollectionException(CollectionException.ItemsLimit, $"Bir koleksiyonda en fazla {PlaceCollectionRules.MaxItems} yer olabilir.");
            item = new PlaceCollectionItem { CollectionId = collection.Id, PlaceId = placeId, Position = collection.Items.Count == 0 ? 0 : collection.Items.Max(i => i.Position) + 1 };
            // Tracking the item fixes up collection.Items itself; adding it there too listed it twice.
            _db.PlaceCollectionItems.Add(item);
        }
        item.Name = Clip(name!.Trim(), SavedPlaceRules.MaxNameLength);
        item.Category = string.IsNullOrWhiteSpace(category) ? null : Clip(category.Trim(), SavedPlaceRules.MaxCategoryLength);
        item.Latitude = latitude;
        item.Longitude = longitude;
        item.Note = CleanOptional(note, PlaceCollectionRules.MaxNoteLength);
        collection.UpdatedAtUtc = DateTime.UtcNow;
        try { await _db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { _db.ChangeTracker.Clear(); /* a parallel add of the same place won */ }
        return ToDetail(await OwnedAsync(me, id, ct), me, null);
    }

    public async Task<CollectionDetailDto> RemoveItemAsync(Guid me, Guid id, Guid placeId, CancellationToken ct)
    {
        var collection = await OwnedAsync(me, id, ct);
        var item = collection.Items.FirstOrDefault(i => i.PlaceId == placeId);
        if (item is not null)
        {
            _db.PlaceCollectionItems.Remove(item);
            collection.Items.Remove(item);
            collection.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
        return ToDetail(collection, me, null);
    }

    /// <summary>A list shared by link, for someone signed in. Private lists, unknown links and blocks all read "not found".</summary>
    public async Task<CollectionDetailDto> GetSharedAsync(Guid viewer, string token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length != PlaceCollectionRules.ShareTokenLength) throw NotFound();
        var collection = await _db.PlaceCollections.Include(c => c.Items).AsNoTracking()
            .FirstOrDefaultAsync(c => c.ShareToken == token && c.Visibility == PlaceCollectionRules.Link, ct) ?? throw NotFound();
        if (collection.UserId != viewer && await BlockQueries.BetweenAsync(_db, viewer, collection.UserId)) throw NotFound();
        var owner = await _db.Users.AsNoTracking().Where(u => u.Id == collection.UserId)
            .Select(u => new CollectionOwnerDto(u.Id, u.UserName, u.DisplayName, u.AvatarKey, u.PhotoVersion)).FirstOrDefaultAsync(ct);
        if (owner is null) throw NotFound();
        return ToDetail(collection, viewer, owner);
    }

    private async Task<PlaceCollection> OwnedAsync(Guid me, Guid id, CancellationToken ct) =>
        await _db.PlaceCollections.Include(c => c.Items).FirstOrDefaultAsync(c => c.Id == id && c.UserId == me, ct) ?? throw NotFound();

    private static CollectionException NotFound() => new(CollectionException.NotFound, "Koleksiyon bulunamadı.");

    private static CollectionItemDto ToItem(PlaceCollectionItem i) => new(i.PlaceId, i.Name, i.Category, i.Latitude, i.Longitude, i.Note, i.AddedAtUtc);

    private static CollectionDetailDto ToDetail(PlaceCollection c, Guid viewer, CollectionOwnerDto? owner)
    {
        var mine = c.UserId == viewer;
        return new CollectionDetailDto(c.Id, c.Title, c.Description, c.Visibility,
            mine && c.Visibility == PlaceCollectionRules.Link ? c.ShareToken : null, mine, owner,
            c.Items.OrderBy(i => i.Position).Select(ToItem).ToList(), c.UpdatedAtUtc);
    }

    private static string CleanRequired(string? value, int max) =>
        CleanOptional(value, max) ?? throw new CollectionException(CollectionException.Invalid, "Başlık gerekli.");

    /// <summary>Trim, collapse whitespace, cap, then the shared text filter (refuse threats/hate, mask ID numbers/plates).</summary>
    private static string? CleanOptional(string? value, int max)
    {
        var text = string.Join(' ', (value ?? string.Empty).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (text.Length == 0) return null;
        if (text.Length > max) throw new CollectionException(CollectionException.Invalid, $"En fazla {max} karakter olabilir.");
        var review = ContentTextFilter.Review(text);
        if (review.Verdict == TextVerdict.Blocked) throw new CollectionException(CollectionException.Blocked, "Bu içerik topluluk kurallarına uymuyor.");
        return review.Text;
    }

    private static string Clip(string value, int max) => value.Length <= max ? value : value[..max];

    /// <summary>16 random bytes, base64url: 22 characters, not guessable.</summary>
    private static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(16)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
