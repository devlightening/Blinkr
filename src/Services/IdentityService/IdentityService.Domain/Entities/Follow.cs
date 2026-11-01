namespace IdentityService.Domain.Entities
{
    public enum FollowStatus
    {
        /// <summary>Asked to follow a private account; waiting for the owner.</summary>
        Pending = 0,
        Accepted = 1,
    }

    /// <summary>
    /// One person following another (sinyal-mvp-plan Faz 6, DECISIONS D-009). One-way: following someone never shares
    /// location, never changes who can see a signal on the map, and is separate from the mutual friendship used for chat.
    /// A private account (<see cref="User.IsPrivate"/>) approves each follower; only then may that follower see the
    /// account's profile grid.
    /// </summary>
    public class Follow
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid FollowerId { get; set; }
        public Guid FolloweeId { get; set; }
        public FollowStatus Status { get; set; } = FollowStatus.Accepted;
        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
        public DateTime? AcceptedAtUtc { get; set; }
    }

    public static class FollowRules
    {
        /// <summary>Follow requests a person may have waiting at once.</summary>
        public const int MaxOutgoingPending = 50;
        /// <summary>People a person may follow in total (keeps follow-spam in check).</summary>
        public const int MaxFollowing = 5000;
        public const int MaxPageSize = 50;
    }
}
