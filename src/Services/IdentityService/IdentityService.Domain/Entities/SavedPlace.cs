namespace IdentityService.Domain.Entities
{
    /// <summary>
    /// A place someone saved (sinyal-mvp-plan P6.8), kept per account so it is the same on every device. The name,
    /// category and coordinates are a display snapshot from the client; the place itself is owned by PlaceService.
    /// Never shown to anyone else.
    /// </summary>
    public class SavedPlace
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid UserId { get; set; }
        public Guid PlaceId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Category { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    public static class SavedPlaceRules
    {
        public const int MaxPerUser = 100;
        public const int MaxNameLength = 160;
        public const int MaxCategoryLength = 40;
        public const int MaxImportBatch = 100;
    }
}
