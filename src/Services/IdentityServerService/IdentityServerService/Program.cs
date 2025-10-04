using Duende.IdentityServer;
using Duende.IdentityServer.Services;
using HealthChecks.UI.Client;
using IdentityServerService.Auth;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(args);

// ---- CORS (Swagger ve UI için)
const string CorsPolicy = "BlinkrCors";
builder.Services.AddCors(o =>
{
    o.AddPolicy(CorsPolicy, p =>
    {
        p.WithOrigins(
            "https://localhost:7259", // BlogService.Api Swagger
            "https://localhost:5173"  // Frontend (varsa)
        )
        .AllowAnyHeader()
        .AllowAnyMethod();
    });
});

// ---- Serilog
builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

// ---- DbContext
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("IdentityDb")));

// ---- HealthChecks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("IdentityServerService-Postgres");

// ---- PEM’den RSA key oku (tek sefer ve tek instance!)
static RsaSecurityKey CreateSigningKey(string privateKeyPath)
{
    var pem = File.ReadAllText(privateKeyPath);
    var rsa = RSA.Create();
    rsa.ImportFromPem(pem);

    return new RsaSecurityKey(rsa)
    {
        KeyId = "blinkr-dev-key",
        CryptoProviderFactory = new CryptoProviderFactory
        {
            // önemli: disposed obj hatalarını engeller
            CacheSignatureProviders = false
        }
    };
}

var privateKeyPath = Path.Combine(builder.Environment.ContentRootPath, "keys", "rsa-private.pem");
var signingKey = CreateSigningKey(privateKeyPath);

// ---- IdentityServer
builder.Services
    .AddIdentityServer(options =>
    {
        options.EmitStaticAudienceClaim = true;
        options.Events.RaiseSuccessEvents = true;
        options.Events.RaiseFailureEvents = true;

        // yerel geliştirme için gerçek issuer kullan
        options.IssuerUri = "https://localhost:7122";
    })
    .AddInMemoryIdentityResources(IdsConfig.IdentityResources)
    .AddInMemoryApiScopes(IdsConfig.ApiScopes)
    .AddInMemoryApiResources(IdsConfig.ApiResources)
    .AddInMemoryClients(IdsConfig.Clients)
    .AddProfileService<ProfileService>()
    .AddInMemoryCaching()
    .AddInMemoryPersistedGrants()
    // aynı key instance + cache kapalı
    .AddSigningCredential(new SigningCredentials(
        signingKey,
        SecurityAlgorithms.RsaSha256)
    {
        CryptoProviderFactory = new CryptoProviderFactory { CacheSignatureProviders = false }
    });

builder.Services.AddAuthorization();
builder.Services.AddTransient<Duende.IdentityServer.Validation.IResourceOwnerPasswordValidator, ResourceOwnerPasswordValidator>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}
app.UseHttpsRedirection();
app.UseCors(CorsPolicy);

app.UseRouting();
app.UseIdentityServer();
app.UseAuthorization();

app.MapGet("/", () => "Blinkr IdentityServer running");

// health
app.UseHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();
