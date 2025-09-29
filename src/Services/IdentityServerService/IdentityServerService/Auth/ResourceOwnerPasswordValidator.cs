using Duende.IdentityServer.Models;
using Duende.IdentityServer.Validation;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using DomainUser = IdentityService.Domain.Entities.User;

namespace IdentityServerService.Auth;

public class ResourceOwnerPasswordValidator : IResourceOwnerPasswordValidator
{
    private readonly AppDbContext _db;

    public ResourceOwnerPasswordValidator(AppDbContext db)
    {
        _db = db;
    }

    public async Task ValidateAsync(ResourceOwnerPasswordValidationContext context)
    {
        // Kullanıcıyı bul
        IdentityService.Domain.Entities.User user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserName == context.UserName);

        // Kullanıcı bulundu ve şifre doğruysa
        if (user is not null && BCrypt.Net.BCrypt.Verify(context.Password, user.PasswordHash))
        {
            var claims = new List<Claim>
            {
                    new Claim("sub", user.Id.ToString()),
                    new Claim("name", user.UserName),
                    new Claim("email", user.Email),
                    new Claim("role", user.Role),              
                    new Claim(ClaimTypes.Role, user.Role)

            };

            context.Result = new GrantValidationResult(
                subject: user.Id.ToString(),
                authenticationMethod: "password",
                claims: claims);

            return;
        }

        // Başarısız giriş
        context.Result = new GrantValidationResult(TokenRequestErrors.InvalidGrant, "Invalid credentials");
    }
}
