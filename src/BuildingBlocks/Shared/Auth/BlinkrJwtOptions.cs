using Microsoft.Extensions.Configuration;

namespace Shared.Auth;

public sealed record BlinkrJwtOptions
{
    public const string DevelopmentOnlySigningKey = "blinkr-development-only-signing-key-change-for-production-2026";
    public const string DefaultIssuer = "Blinkr.Identity";
    public const string DefaultAudience = "blinkr.api";
    public const string Algorithm = "HS256";
    public const string CanonicalUserIdClaim = "sub";
    public const string RoleClaimType = "role";
    public const string ScopeClaimType = "scope";

    public required string SigningKey { get; init; }
    public string Issuer { get; init; } = DefaultIssuer;
    public string Audience { get; init; } = DefaultAudience;
    public TimeSpan AccessTokenLifetime { get; init; } = TimeSpan.FromMinutes(60);
    public TimeSpan RefreshTokenLifetime { get; init; } = TimeSpan.FromDays(7);
    public TimeSpan ClockSkew { get; init; } = TimeSpan.FromMinutes(1);

    public static BlinkrJwtOptions FromConfiguration(
        IConfiguration configuration,
        string environmentName = "Production")
    {
        var section = configuration.GetSection("Jwt");
        if (string.IsNullOrWhiteSpace(environmentName) || environmentName == "Production")
        {
            environmentName =
                Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ??
                Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ??
                environmentName;
        }
        var signingKey =
            configuration["BLINKR_JWT_KEY"] ??
            section["Key"] ??
            section["SigningKey"];

        var isDevelopment = string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(signingKey))
        {
            if (!isDevelopment)
            {
                throw new InvalidOperationException("BLINKR_JWT_KEY or Jwt:Key must be configured outside Development.");
            }

            signingKey = DevelopmentOnlySigningKey;
        }

        if (!isDevelopment && signingKey == DevelopmentOnlySigningKey)
        {
            throw new InvalidOperationException("The development-only JWT signing key cannot be used outside Development.");
        }

        return new BlinkrJwtOptions
        {
            SigningKey = signingKey,
            Issuer = configuration["BLINKR_JWT_ISSUER"] ?? section["Issuer"] ?? DefaultIssuer,
            Audience = configuration["BLINKR_JWT_AUDIENCE"] ?? section["Audience"] ?? DefaultAudience,
            AccessTokenLifetime = TimeSpan.FromMinutes(ReadPositiveInt(section, "AccessTokenMinutes", 60)),
            RefreshTokenLifetime = TimeSpan.FromDays(ReadPositiveInt(section, "RefreshTokenDays", 7)),
            ClockSkew = TimeSpan.FromSeconds(ReadPositiveInt(section, "ClockSkewSeconds", 60))
        };
    }

    private static int ReadPositiveInt(IConfigurationSection section, string name, int defaultValue)
    {
        return int.TryParse(section[name], out var value) && value > 0 ? value : defaultValue;
    }
}
