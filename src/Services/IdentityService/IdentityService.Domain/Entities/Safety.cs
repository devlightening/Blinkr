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
        /// <summary>Hate speech (sinyal-mvp-plan 11 §4 report reasons).</summary>
        Hate = 5,
        Nudity = 6,
        Violence = 7,
        /// <summary>My (or someone's) image or details shared without consent.</summary>
        Privacy = 8,
        /// <summary>Someone may hurt themselves: reviewed first, and the reporter is shown where to find help.</summary>
        SelfHarm = 9,
    }

    public enum ReportStatus
    {
        Open = 0,
        /// <summary>A moderator (or the auto-hide rule followed by a moderator) closed it.</summary>
        Resolved = 1,
    }

    /// <summary>
    /// One moderation decision, kept for the audit trail (sinyal-mvp-plan 11 §4 `moderation_actions`). ModeratorId is
    /// <see cref="Guid.Empty"/> for the automatic "hide after enough reports" rule.
    /// </summary>
    public class ModerationAction
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ModeratorId { get; set; }
        public ReportTargetType TargetType { get; set; }
        public string TargetId { get; set; } = null!;
        /// <summary>auto_hide | hide | restore | remove | dismiss | warn | restrict_24h | suspend_7d | ban</summary>
        public string Action { get; set; } = null!;
        public string? Note { get; set; }
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
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
        /// <summary>How much this report counts towards auto-hide: accounts younger than a day count half.</summary>
        public double Weight { get; set; } = 1.0;
        public ReportStatus Status { get; set; } = ReportStatus.Open;
        public DateTime? ResolvedAtUtc { get; set; }
    }

    public static class SafetyRules
    {
        public const int MaxNoteLength = 300;
        public const int MaxTargetIdLength = 64;
        /// <summary>Reports one person may file per day: enough for real use, too few to weaponise the button.</summary>
        public const int MaxReportsPerDay = 20;
        public const int MaxBlocks = 500;
        /// <summary>Open, weighted reports on one signal that hide it until a moderator looks (11 §4).</summary>
        public const double AutoHideScore = 3.0;
        /// <summary>Reporters younger than this count half, so a burst of fresh accounts cannot hide a signal as easily.</summary>
        public static readonly TimeSpan TrustedReporterAge = TimeSpan.FromDays(1);
        public const double NewReporterWeight = 0.5;
        public const int MaxModerationNoteLength = 300;
    }

    /// <summary>Sign-in refused: the account is suspended until <see cref="UntilUtc"/> (<see cref="Sanctions.Forever"/> = closed).</summary>
    public sealed class AccountSuspendedException : Exception
    {
        public AccountSuspendedException(DateTime untilUtc) : base("ACCOUNT_SUSPENDED") => UntilUtc = untilUtc;
        public DateTime UntilUtc { get; }
    }

    /// <summary>The sanction ladder (11 §4): warning → 24 h no posting → 7 day suspension → closed for good.</summary>
    public static class Sanctions
    {
        public const string Warn = "warn";
        public const string Restrict24h = "restrict_24h";
        public const string Suspend7d = "suspend_7d";
        public const string Ban = "ban";
        public static readonly DateTime Forever = new(9999, 12, 31, 0, 0, 0, DateTimeKind.Utc);
        public static bool IsUserAction(string action) => action is Warn or Restrict24h or Suspend7d or Ban;
    }
}
