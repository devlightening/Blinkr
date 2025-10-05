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

    public static IEnumerable<Client> Clients => new[]
    {
        // Swagger/Postman için ROPC (Refresh destekli)
        new Client
        {
            ClientId = "blinkr.ro.client",
            AllowedGrantTypes = GrantTypes.ResourceOwnerPassword,
            ClientSecrets = { new Secret("super_secret".Sha256()) },

            AllowedScopes =
            {
                "openid","profile","roles",
                "blinkr.api.read","blinkr.api.write",
                "offline_access" // refresh token için şart
            },

            // ---- Access/Identity token ömürleri (örnek)
            AccessTokenLifetime = 60 * 30,            // 30 dk
            IdentityTokenLifetime = 60 * 10,          // 10 dk

            // ---- Refresh token davranışı
            AllowOfflineAccess = true,
            RefreshTokenUsage = TokenUsage.ReUse,     // veya OneTime
            RefreshTokenExpiration = TokenExpiration.Sliding,
            AbsoluteRefreshTokenLifetime = 60 * 60 * 24 * 30, // 30 gün
            SlidingRefreshTokenLifetime  = 60 * 60 * 24 * 7,  // 7 gün

            // Swagger (BlogService.Api) için CORS
            AllowedCorsOrigins = { "https://localhost:7259" },
            // Dev’de gerekebilir:
            // AllowedCorsOrigins = { "http://localhost:7259", "https://localhost:7259" },

            // Refresh sonrası access token claim’lerini güncellemek istersen:
            UpdateAccessTokenClaimsOnRefresh = true
        },

        // ileride web/mobile için PKCE örneği
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
