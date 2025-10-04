using Duende.IdentityServer.Models;

namespace IdentityServerService.Auth;

public static class IdsConfig
{
    public static IEnumerable<IdentityResource> IdentityResources => new[]
    {
        new IdentityResources.OpenId(),
        new IdentityResources.Profile(),
        // role claim'i açıkça expose ediyoruz
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
            // token’a taşınabilecek user claim’leri
            UserClaims = { "role", "name", "email" }
        }
    };

    public static IEnumerable<Client> Clients => new[]
    {
        // Postman/Swagger için ROPC
        new Client
        {
            ClientId = "blinkr.ro.client",
            AllowedGrantTypes = GrantTypes.ResourceOwnerPassword,
            ClientSecrets = { new Secret("super_secret".Sha256()) },
            AllowedScopes =
            {
                "openid", "profile", "roles",
                "blinkr.api.read", "blinkr.api.write",
                "offline_access"
            },
            AccessTokenLifetime = 3600,
            AllowOfflineAccess = true,

            AllowedCorsOrigins = { "https://localhost:7259" },



             RefreshTokenUsage = TokenUsage.ReUse,          // veya OneTime
             RefreshTokenExpiration = TokenExpiration.Sliding,
             AbsoluteRefreshTokenLifetime = 60 * 60 * 24 * 30,   // 30 gün
             SlidingRefreshTokenLifetime  = 60 * 60 * 24 * 7,    // 7 gün
        },

        // ileride web/mobile için PKCE
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
