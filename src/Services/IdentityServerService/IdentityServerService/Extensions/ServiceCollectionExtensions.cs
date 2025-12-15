using Duende.IdentityServer;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.EntityFramework.DbContexts;
using IdentityServerService.Auth;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;

namespace IdentityServerService.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddIdentityServiceCors(this IServiceCollection services)
    {
        const string CorsPolicy = "BlinkrCors";
        services.AddCors(o =>
        {
            o.AddPolicy(CorsPolicy, p =>
            {
                p.WithOrigins(
                        "https://localhost:7259",
                        "http://localhost:5215",
                        "https://localhost:5173"
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });
        return services;
    }

    public static IServiceCollection AddIdentityServiceDatabase(this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("DefaultConnection");
        var migrationsAssembly = typeof(AppDbContext).Assembly.FullName;

        services.AddDbContext<AppDbContext>(opt =>
            opt.UseNpgsql(connectionString,
                npg => npg.MigrationsAssembly(migrationsAssembly).CommandTimeout(300))
               .EnableDetailedErrors()
               .EnableSensitiveDataLogging());

        services.AddHealthChecks()
            .AddDbContextCheck<AppDbContext>("IdentityServerService-Postgres");

        return services;
    }

    public static IServiceCollection AddIdentityServerConfiguration(this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("DefaultConnection");
        var migrationsAssembly = typeof(AppDbContext).Assembly.FullName;
        var issuerUri = "https://localhost:7122";

        var signingKey = LoadRsaKey(Path.Combine(AppContext.BaseDirectory, "keys", "rsa-private.pem"));

        services
            .AddIdentityServer(options =>
            {
                options.EmitStaticAudienceClaim = true;
                options.Events.RaiseSuccessEvents = true;
                options.Events.RaiseFailureEvents = true;
                options.IssuerUri = issuerUri;
            })
            .AddInMemoryIdentityResources(IdsConfig.IdentityResources)
            .AddInMemoryApiScopes(IdsConfig.ApiScopes)
            .AddInMemoryApiResources(IdsConfig.ApiResources)
            .AddInMemoryClients(IdsConfig.Clients)
            .AddOperationalStore(opt =>
            {
                opt.ConfigureDbContext = b =>
                    b.UseNpgsql(connectionString, sql => sql.MigrationsAssembly(migrationsAssembly).CommandTimeout(300))
                     .EnableDetailedErrors();
                opt.EnableTokenCleanup = true;
                opt.TokenCleanupInterval = 3600;
            })
            .AddProfileService<ProfileService>()
            .AddSigningCredential(signingKey, IdentityServerConstants.RsaSigningAlgorithm.RS256);

        services.AddTransient<Duende.IdentityServer.Validation.IResourceOwnerPasswordValidator, ResourceOwnerPasswordValidator>();
        services.AddAuthorization();
        services.AddRazorPages();

        services.AddSingleton<ICorsPolicyService>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<DefaultCorsPolicyService>>();
            return new DefaultCorsPolicyService(logger)
            {
                AllowedOrigins = { "https://localhost:7259", "https://localhost:5173" }
            };
        });

        return services;
    }

    private static RsaSecurityKey LoadRsaKey(string privateKeyPath)
    {
        var pem = File.ReadAllText(privateKeyPath);
        var rsa = RSA.Create();
        rsa.ImportFromPem(pem);
        return new RsaSecurityKey(rsa) { KeyId = "blinkr-dev-key" };
    }
}
