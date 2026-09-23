using MongoDB.Bson.Serialization.Attributes;

namespace NotificationsService.Api.Stories;

/// <summary>
/// A story (sinyal-mvp-plan Faz 7): a photo or short video that lives 24 hours, seen by the author and the people who
/// follow them (accepted follows only). No location is kept or shown. The media sits in the same private disk store
/// as snaps and is only ever served to someone allowed to see it.
/// </summary>
public class StoryDocument
{
    [BsonId]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string MediaKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string MediaType { get; set; } = "Image";
    public string? Caption { get; set; }
    public int DurationSeconds { get; set; } = 5;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; }
    public List<StoryView> Views { get; set; } = new();
}

public class StoryView
{
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public DateTime SeenAtUtc { get; set; }
}

public record StoryTrayItemDto(Guid AuthorId, string AuthorName, bool IsMine, int StoryCount, DateTime LatestAtUtc, bool AllSeen);
public record StoryItemDto(string Id, Guid AuthorId, string AuthorName, string MediaType, string? Caption, int DurationSeconds, DateTime CreatedAtUtc, DateTime ExpiresAtUtc, bool Seen, int? ViewerCount);
public record StoryViewerDto(Guid UserId, string UserName, DateTime SeenAtUtc);

public static class StoryRules
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);
    public static readonly int[] PhotoDurations = { 3, 5, 10 };
    public const int MaxActivePerAuthor = 30;
    public const int MaxCaptionLength = 80;

    /// <summary>Tray order: my own first, then people with unseen stories (newest first), then the rest.</summary>
    public static IEnumerable<StoryTrayItemDto> Order(IEnumerable<StoryTrayItemDto> items) =>
        items.OrderByDescending(i => i.IsMine).ThenBy(i => i.AllSeen).ThenByDescending(i => i.LatestAtUtc);
}
