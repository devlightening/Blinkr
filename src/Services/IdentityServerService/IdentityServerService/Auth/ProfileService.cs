using Duende.IdentityServer.Models;
using Duende.IdentityServer.Services;
using System.Security.Claims;

namespace IdentityServerService.Auth;

public class ProfileService : IProfileService
{
    public Task GetProfileDataAsync(ProfileDataRequestContext context)
    {
        var subClaim = context.Subject.FindFirst("sub") ??
                       context.Subject.FindFirst(ClaimTypes.NameIdentifier);

        var claims = context.Subject.Claims.ToList();

        // Eğer sub yoksa, oluştur
        if (subClaim == null)
        {
            var userId = context.Subject.Identity?.Name ?? Guid.NewGuid().ToString();
            claims.Add(new Claim("sub", userId));
        }

        context.IssuedClaims.AddRange(claims);
        return Task.CompletedTask;
    }

    public Task IsActiveAsync(IsActiveContext context)
    {
        context.IsActive = true;
        return Task.CompletedTask;
    }

}
