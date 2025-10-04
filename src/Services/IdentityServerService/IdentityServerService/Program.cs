using Duende.IdentityServer;
using HealthChecks.UI.Client;
using IdentityServerService.Auth;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

// DbContext
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("IdentityDb")));

// HealthChecks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("IdentityServerService-Postgres");

// 1) PEM'den RSA key'i oku
static RsaSecurityKey LoadRsaKey(string privateKeyPath)
{
    var pem = File.ReadAllText(privateKeyPath);
    var rsa = RSA.Create();
    rsa.ImportFromPem(pem);                      
    return new RsaSecurityKey(rsa) { KeyId = "blinkr-dev-key" };
}
var signingKey = LoadRsaKey(Path.Combine(builder.Environment.ContentRootPath, "keys", "rsa-private.pem"));

// 2) IdentityServer (KeyManagement kapalý!)
builder.Services
    .AddIdentityServer(options =>
    {
        options.EmitStaticAudienceClaim = true;
        options.Events.RaiseSuccessEvents = true;
        options.Events.RaiseFailureEvents = true;
        options.IssuerUri = "https://localhost:7122";

        // *** kritik: otomatik key üretimini kapat ***
        options.KeyManagement.Enabled = false;
    })
    .AddInMemoryIdentityResources(IdsConfig.IdentityResources)
    .AddInMemoryApiScopes(IdsConfig.ApiScopes)
    .AddInMemoryApiResources(IdsConfig.ApiResources)
    .AddInMemoryClients(IdsConfig.Clients)
    .AddProfileService<ProfileService>()
    // 3) Sadece bizim RSA key ile imzala
    .AddSigningCredential(signingKey, IdentityServerConstants.RsaSigningAlgorithm.RS256);

builder.Services.AddAuthorization();
builder.Services.AddTransient<Duende.IdentityServer.Validation.IResourceOwnerPasswordValidator, ResourceOwnerPasswordValidator>();

var app = builder.Build();

app.UseSerilogRequestLogging();
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
