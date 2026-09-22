namespace IdentityService.Domain.Entities
{
    public enum FriendshipStatus
    {
        Pending = 0,
        Accepted = 1,
        /// <summary>The addressee said no. The row stays so the same request cannot be repeated straight away.</summary>
        Declined = 2,
    }

    /// <summary>
    /// A friend request between two people, and the friendship it becomes. One row per pair, whichever way it was sent
    /// (<see cref="UserAId"/> is always the smaller id). Friendship is for finding each other and for messaging;
    /// it never shares location and never makes anyone's signals private or public.
    /// </summary>
    public class Friendship
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid RequesterId { get; set; }
        public Guid AddresseeId { get; set; }
        public Guid UserAId { get; set; }
        public Guid UserBId { get; set; }
        public FriendshipStatus Status { get; set; } = FriendshipStatus.Pending;
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedAtUtc { get; set; }

        public static (Guid A, Guid B) Pair(Guid first, Guid second) =>
            first.CompareTo(second) <= 0 ? (first, second) : (second, first);
    }

    public static class FriendshipRules
    {
        public const int MaxBioLength = 160;
        /// <summary>Requests a person may have waiting at once: keeps a new account from spraying requests.</summary>
        public const int MaxOutgoingPending = 50;
        /// <summary>How long a declined request blocks the same person from asking again.</summary>
        public static readonly TimeSpan DeclineCooldown = TimeSpan.FromDays(7);
    }
}
