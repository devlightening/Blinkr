using Microsoft.AspNetCore.Authorization;

namespace BlogService.Api.Auth
{
    public class OwnerOrAdminHandler : AuthorizationHandler<OwnerOrAdminRequirement>
    {
        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context,
            OwnerOrAdminRequirement requirement)
        {
            var userIdClaim = context.User.FindFirst("sub")?.Value;
            var roleClaim = context.User.FindFirst("role")?.Value;

            // debug log
            Console.WriteLine($"[AUTHZ DEBUG] sub={userIdClaim}, role={roleClaim}, postAuthor={requirement.AuthorId}");

            if (userIdClaim is null)
            {
                Console.WriteLine("[AUTHZ] FAIL: userIdClaim null");
                return Task.CompletedTask;
            }

            if (roleClaim == "Admin" || userIdClaim == requirement.AuthorId.ToString())
            {
                context.Succeed(requirement);
                Console.WriteLine("[AUTHZ] SUCCESS ✅");
            }
            else
            {
                Console.WriteLine("[AUTHZ] FAIL ❌");
            }

            return Task.CompletedTask;
        }
    }
}
