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

// --- Sabit RSA Key Yükleme ---
var rsa = RSA.Create();
rsa.ImportFromPem(File.ReadAllText("keys/rsa-private.pem")); // kendi private key'in
var rsaKey = new RsaSecurityKey(rsa)
{
    KeyId = "blinkr-dev-key" // sabit KID
};

// IdentityServer
builder.Services.AddIdentityServer(options =>
{
    options.EmitStaticAudienceClaim = true;
    options.Events.RaiseSuccessEvents = true;
    options.Events.RaiseFailureEvents = true;
    options.IssuerUri = "https://localhost:7122"; // sabit issuer
})
.AddSigningCredential(rsaKey, IdentityServerConstants.RsaSigningAlgorithm.RS256)
.AddInMemoryIdentityResources(IdsConfig.IdentityResources)
.AddInMemoryApiScopes(IdsConfig.ApiScopes)
.AddInMemoryApiResources(IdsConfig.ApiResources)
.AddInMemoryClients(IdsConfig.Clients)
.AddProfileService<ProfileService>();

builder.Services.AddAuthorization();
builder.Services.AddTransient<Duende.IdentityServer.Validation.IResourceOwnerPasswordValidator, ResourceOwnerPasswordValidator>();

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseRouting();

app.UseIdentityServer();
app.UseAuthorization();

app.MapGet("/", () => "Blinkr IdentityServer running");

// Health endpoint
app.UseHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();
