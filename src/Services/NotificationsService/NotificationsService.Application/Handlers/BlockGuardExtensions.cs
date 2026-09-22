using NotificationsService.Application.Exceptions;
using NotificationsService.Domain.Interfaces;

namespace NotificationsService.Application.Handlers;

public static class BlockGuardExtensions
{
    /// <summary>Throws unless the two people may message each other. The message never says who blocked whom.</summary>
    public static async Task EnsureAllowedAsync(this IBlockGuard guard, Guid me, Guid other, CancellationToken ct)
    {
        switch (await guard.CheckAsync(me, other, ct))
        {
            case BlockCheck.Blocked: throw new ChatForbiddenException("Bu kişiye mesaj gönderemezsin.");
            case BlockCheck.Unavailable: throw new ChatUnavailableException();
        }
    }

    public static Guid OtherParticipant(this IEnumerable<Guid> participants, Guid me) => participants.FirstOrDefault(p => p != me);
}
