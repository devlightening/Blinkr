using Duende.IdentityServer.Models;

namespace IdentityServerService.Auth;

public static class IdsConfig
{
    public static IEnumerable<IdentityResource> IdentityResources => new[]
    {
        new IdentityResources.OpenId(),
        new IdentityResources.Profile(),
        new IdentityResource("roles", new[] { "role" })
    };

    public static IEnumerable<ApiScope> ApiScopes => new[]
    {
        new ApiScope("blinkr.api.read"),
        new ApiScope("blinkr.api.write")
    };

    public static IEnumerable<ApiResource> ApiResources => new[]
    {
        new ApiResource("blinkr.api", "Blinkr Microservices")
        {
            Scopes = { "blinkr.api.read", "blinkr.api.write" },
            UserClaims = { "role", "name", "email" }
        }
    };

    // Başlangıç: Resource Owner Password + Swagger/Postman için client
    public static IEnumerable<Client> Clients => new[]
    {
       new Client
        {
            ClientId = "blinkr.ro.client",
            AllowedGrantTypes = GrantTypes.ResourceOwnerPassword,
            ClientSecrets = { new Secret("super_secret".Sha256()) },
            AllowedScopes =
            {
                "openid",
                "profile",
                "roles",
                "blinkr.api.read",
                "blinkr.api.write",
                "offline_access"   
            },
            AccessTokenLifetime = 3600,
            AllowOfflineAccess = true
        },


        // İleride mobil/web için (PKCE)
        new Client
        {
            ClientId = "blinkr.ui",
            RequireClientSecret = false,
            AllowedGrantTypes = GrantTypes.Code,
            RedirectUris = { "https://localhost:5173/auth/callback" },
            PostLogoutRedirectUris = { "https://localhost:5173/" },
            AllowedScopes = { "openid", "profile", "roles", "blinkr.api.read" },
            RequirePkce = true,
            AllowAccessTokensViaBrowser = false
        }
    };
}
