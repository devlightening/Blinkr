using Duende.IdentityServer;
using IdentityServerService.Auth;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .WriteTo.Console());

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("IdentityDb")));

// IdentityServer config
builder.Services.AddIdentityServer(options =>
{
    options.EmitStaticAudienceClaim = true;
    options.Events.RaiseSuccessEvents = true;
    options.Events.RaiseFailureEvents = true;
})
    .AddInMemoryIdentityResources(IdsConfig.IdentityResources)
    .AddInMemoryApiScopes(IdsConfig.ApiScopes)
    .AddInMemoryApiResources(IdsConfig.ApiResources)
    .AddInMemoryClients(IdsConfig.Clients)
    .AddProfileService<ProfileService>()
    .AddDeveloperSigningCredential();


builder.Services.AddAuthorization();

builder.Services.AddTransient<
    Duende.IdentityServer.Validation.IResourceOwnerPasswordValidator,
    ResourceOwnerPasswordValidator>();

var app = builder.Build();

app.UseSerilogRequestLogging();

app.UseRouting();

app.UseIdentityServer();


app.UseAuthorization();

app.MapGet("/", () => "Blinkr IdentityServer running ");

app.Run();
