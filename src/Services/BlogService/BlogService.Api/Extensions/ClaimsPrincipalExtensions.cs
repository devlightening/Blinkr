using System.Security.Claims;

namespace BlogService.Api.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        public static Guid? GetUserId(this ClaimsPrincipal user)
        {
            var sub = user.FindFirstValue("sub")
                      ?? user.FindFirstValue(ClaimTypes.NameIdentifier); // fallback

            if (string.IsNullOrEmpty(sub))
                return null;

            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }
}
