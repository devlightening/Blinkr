using Duende.IdentityServer.Models;
using Duende.IdentityServer.Validation;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IdentityServerService.Auth;

public class ResourceOwnerPasswordValidator : IResourceOwnerPasswordValidator
{
    private readonly AppDbContext _db;

    public ResourceOwnerPasswordValidator(AppDbContext db) => _db = db;

    public async Task ValidateAsync(ResourceOwnerPasswordValidationContext context)
    {
        var user = await _db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName == context.UserName);

        if (user is null || !BCrypt.Net.BCrypt.Verify(context.Password, user.PasswordHash))
        {
            context.Result = new GrantValidationResult(TokenRequestErrors.InvalidGrant, "Invalid credentials");
            return;
        }

        var claims = new List<Claim>
        {
            new("sub", user.Id.ToString()),
            new("name", user.UserName),
            new("email", user.Email),
            new("role", user.Role),
            // bazı kütüphaneler ClaimTypes.Role bekler, onu da dolduralım
            new(ClaimTypes.Role, user.Role)
        };

        context.Result = new GrantValidationResult(
            subject: user.Id.ToString(),
            authenticationMethod: "password",
            claims: claims);
    }
}
