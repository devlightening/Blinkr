namespace NotificationsService.Domain.Interfaces;

public enum BlockCheck
{
    Allowed,
    /// <summary>One of the two people blocked the other.</summary>
    Blocked,
    /// <summary>The identity service could not answer; the caller must not assume "allowed".</summary>
    Unavailable,
}

/// <summary>Asks the identity service (the owner of blocks) whether two people may exchange messages.</summary>
public interface IBlockGuard
{
    Task<BlockCheck> CheckAsync(Guid me, Guid other, CancellationToken ct);
}
