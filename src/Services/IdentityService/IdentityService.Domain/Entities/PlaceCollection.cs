namespace IdentityService.Domain.Entities
{
    /// <summary>
    /// "Koleksiyonlar" (D-041): a named list of places ("Ders çalışmalık kafeler"), like an Instagram guide but every place
    /// shows its live state when opened. Private by default; "link" makes it viewable by anyone signed in who has the
    /// unguessable link. Places are display snapshots; the places themselves (and their state) belong to PlaceService.
    /// </summary>
    public class PlaceCollection
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Visibility { get; set; } = PlaceCollectionRules.Private;
        /// <summary>Set the first time the list is shared by link; a new one can be issued to cut old links off.</summary>
        public string? ShareToken { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
        public List<PlaceCollectionItem> Items { get; set; } = new();
    }

    public class PlaceCollectionItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid CollectionId { get; set; }
        public Guid PlaceId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Category { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        /// <summary>The owner's short note ("sessiz köşe, priz var").</summary>
        public string? Note { get; set; }
        /// <summary>Order in the list; new places go to the end.</summary>
        public int Position { get; set; }
        public DateTime AddedAtUtc { get; set; } = DateTime.UtcNow;
    }

    public static class PlaceCollectionRules
    {
        public const string Private = "private";
        public const string Link = "link";

        public const int MaxPerUser = 20;
        public const int MaxItems = 50;
        public const int MaxTitleLength = 60;
        public const int MaxDescriptionLength = 160;
        public const int MaxNoteLength = 140;
        public const int ShareTokenLength = 22;

        public static bool IsVisibility(string? value) => value is Private or Link;
    }
}
