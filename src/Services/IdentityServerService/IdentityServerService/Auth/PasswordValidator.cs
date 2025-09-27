using Duende.IdentityServer.Models;
using Duende.IdentityServer.Validation;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace IdentityServerService.Auth;

public class ResourceOwnerPasswordValidator(AppDbContext db) : IResourceOwnerPasswordValidator
{
    public async Task ValidateAsync(ResourceOwnerPasswordValidationContext context)
    {
        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName == context.UserName);

        if (user is not null && BCrypt.Net.BCrypt.Verify(context.Password, user.PasswordHash))
        {
            context.Result = new GrantValidationResult(
                subject: user.Id.ToString(),
                authenticationMethod: "password",
                claims: new[]
                {
                    new System.Security.Claims.Claim("name", user.UserName),
                    new System.Security.Claims.Claim("email", user.Email),
                    new System.Security.Claims.Claim("role", "user")
                });
            return;
        }

        context.Result = new GrantValidationResult(TokenRequestErrors.InvalidGrant, "Invalid credentials");
    }
}
