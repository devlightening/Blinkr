using System.Security.Claims;

namespace PlaceService.Api.Infrastructure;

/// <summary>The signed-in person's id, or null for anonymous readers. Same claims every Blinkr service reads.</summary>
public static class UserClaims
{
    public static Guid? UserIdOrNull(this ClaimsPrincipal user)
    {
        var raw = user.Identity?.Name ?? user.FindFirst("sub")?.Value ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
