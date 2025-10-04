using System.Security.Claims;

namespace BlogService.Api.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        public static Guid? GetUserId(this ClaimsPrincipal user)
        {
            var id = user.FindFirst("sub")?.Value
                     ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? user.FindFirst("nameidentifier")?.Value
                     ?? user.FindFirst("nameid")?.Value;

            return Guid.TryParse(id, out var guid) ? guid : null;
        }
    }
}
