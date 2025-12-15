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

        // preferred_username claim'i ekle (UserName)
        var userNameClaim = context.Subject.FindFirst("preferred_username") ??
                            context.Subject.FindFirst(ClaimTypes.Name) ??
                            context.Subject.FindFirst("name");
        
        if (userNameClaim != null && !claims.Any(c => c.Type == "preferred_username"))
        {
            claims.Add(new Claim("preferred_username", userNameClaim.Value));
        }

        // gender claim'i ekle (User cinsiyet bilgisi - harita pin rengi için)
        var genderClaim = context.Subject.FindFirst("gender");
        if (genderClaim != null && !claims.Any(c => c.Type == "gender"))
        {
            claims.Add(new Claim("gender", genderClaim.Value));
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
