using Duende.IdentityServer;
using HealthChecks.UI.Client;
using IdentityServerService.Auth;
using IdentityService.Infrastructure.Data;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

// DbContext
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("IdentityDb")));

// HealthChecks
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("IdentityServerService-Postgres");

builder.Services.AddIdentityServer(options =>
{
    options.EmitStaticAudienceClaim = true;
    options.Events.RaiseSuccessEvents = true;
    options.Events.RaiseFailureEvents = true;
    // dev ortamýnda iss sabit kalsýn istiyorsan:
    // options.IssuerUri = "https://localhost:7122";
})
    .AddInMemoryIdentityResources(IdsConfig.IdentityResources)
    .AddInMemoryApiScopes(IdsConfig.ApiScopes)
    .AddInMemoryApiResources(IdsConfig.ApiResources)
    .AddInMemoryClients(IdsConfig.Clients)
    .AddProfileService<ProfileService>()
    // KESÝNLÝKLE kalýcý key: JWKS kid sabit kalsýn, API tarafýnda key bulunamama hatasý çözülür
    .AddDeveloperSigningCredential(persistKey: true);

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
