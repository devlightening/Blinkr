namespace BlogService.Domain.Events
{
    /// <summary>
    /// A person @mentioned in a post or comment (V2-4, D-027). Resolved by the server from the text (never taken from the
    /// client), with the name as it was at write time so read models can link "@name" without calling IdentityService.
    /// </summary>
    public record MentionRef(Guid UserId, string UserName);
}
