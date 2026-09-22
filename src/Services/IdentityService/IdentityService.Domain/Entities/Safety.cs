namespace IdentityService.Domain.Entities
{
    /// <summary>
    /// "I do not want to deal with this person." One row per direction. A block ends any friendship, hides both people from
    /// each other in search, and stops friend requests and chat between them. It never reveals itself to the blocked person
    /// beyond "you cannot contact this person".
    /// </summary>
    public class UserBlock
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid BlockerId { get; set; }
        public Guid BlockedId { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    public enum ReportTargetType
    {
        User = 0,
        /// <summary>A published signal (post); the id is the post id kept by the content service.</summary>
        Signal = 1,
    }

    public enum ReportReason
    {
        Spam = 0,
        Harassment = 1,
        Inappropriate = 2,
        /// <summary>The signal says something that is not true (wrong place, wrong state).</summary>
        WrongInfo = 3,
        Other = 4,
    }

    /// <summary>
    /// A user's report of a person or a signal, stored for a future moderation queue. There is no moderator tool yet
    /// (see CLAUDE.md, P2 safety); storing the report is what makes that tool possible without asking users again.
    /// </summary>
    public class Report
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ReporterId { get; set; }
        public ReportTargetType TargetType { get; set; }
        public string TargetId { get; set; } = null!;
        public ReportReason Reason { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }

    public static class SafetyRules
    {
        public const int MaxNoteLength = 300;
        public const int MaxTargetIdLength = 64;
        /// <summary>Reports one person may file per day: enough for real use, too few to weaponise the button.</summary>
        public const int MaxReportsPerDay = 20;
        public const int MaxBlocks = 500;
    }
}
