namespace IdentityService.Domain.Entities
{
    public class User   
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string UserName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string Role { get; set; } = "User";
        /// <summary>Chosen avatar (see AvatarCatalog); null = the client draws a default from the user id.</summary>
        public string? AvatarKey { get; set; }
        /// <summary>Short public line about the person; null = none.</summary>
        public string? Bio { get; set; }
        /// <summary>A private account approves each follower; non-followers see the profile header only (D-009).</summary>
        public bool IsPrivate { get; set; }
        /// <summary>Moderation: until then the person cannot post signals, comments or stories (chat still works).</summary>
        public DateTime? RestrictedUntilUtc { get; set; }
        /// <summary>Moderation: until then the person cannot sign in or refresh a session; <see cref="Sanctions.Forever"/> = closed.</summary>
        public DateTime? SuspendedUntilUtc { get; set; }
        public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    }
}
