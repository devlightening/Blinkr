using Duende.IdentityServer;
using Duende.IdentityServer.Services;
using Duende.IdentityServer.EntityFramework.DbContexts;
using HealthChecks.UI.Client;
using IdentityServerService.Auth;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Security.Cryptography;
using Npgsql;
using IdentityService.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// CORS
const string CorsPolicy = "BlinkrCors";
builder.Services.AddCors(o =>
{
    o.AddPolicy(CorsPolicy, p =>
    {
        p.WithOrigins(
                "https://localhost:7259", // BlogService Swagger
                "http://localhost:5215",   // BlogService Swagger
                "https://localhost:5173"   // UI (dev)
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // OAuth2 için gerekli
    });
});

// Serilog
builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

// Users DB (senin AppDbContext’in)
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"),
        npg => npg.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)
                  .CommandTimeout(300)) // 5 dakika timeout
       .EnableDetailedErrors()
       .EnableSensitiveDataLogging());

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("IdentityServerService-Postgres");

// RSA signing key (PEM)
static RsaSecurityKey LoadRsaKey(string privateKeyPath)
{
    var pem = File.ReadAllText(privateKeyPath);
    var rsa = RSA.Create();
    rsa.ImportFromPem(pem);
    return new RsaSecurityKey(rsa) { KeyId = "blinkr-dev-key" };
}
var signingKey = LoadRsaKey(Path.Combine(builder.Environment.ContentRootPath, "keys", "rsa-private.pem"));

var issuerUri = "https://localhost:7122";
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var migrationsAssembly = typeof(AppDbContext).Assembly.FullName;

// IdentityServer
builder.Services
    .AddIdentityServer(options =>
    {
        options.EmitStaticAudienceClaim = true;
        options.Events.RaiseSuccessEvents = true;
        options.Events.RaiseFailureEvents = true;
        options.IssuerUri = issuerUri;
    })
    // In-memory config (clients/scopes/resources)
    .AddInMemoryIdentityResources(IdsConfig.IdentityResources)
    .AddInMemoryApiScopes(IdsConfig.ApiScopes)
    .AddInMemoryApiResources(IdsConfig.ApiResources)
    .AddInMemoryClients(IdsConfig.Clients)

    // EF Operational Store (Refresh Tokens kalıcı)
    .AddOperationalStore(opt =>
    {
        opt.ConfigureDbContext = b =>
            b.UseNpgsql(connectionString, sql => sql.MigrationsAssembly(migrationsAssembly)
                                                     .CommandTimeout(300)) // 5 dakika timeout
             .EnableDetailedErrors();
        opt.EnableTokenCleanup = true;
        opt.TokenCleanupInterval = 3600;
    })

    .AddProfileService<ProfileService>()
    .AddSigningCredential(signingKey, IdentityServerConstants.RsaSigningAlgorithm.RS256);

// ROPC validator (kendi Users tablon)
builder.Services.AddTransient<Duende.IdentityServer.Validation.IResourceOwnerPasswordValidator, ResourceOwnerPasswordValidator>();

// Yetkilendirme Servisini Ekle (app.UseAuthorization() için zorunludur)
builder.Services.AddAuthorization();

// Razor Pages (Login UI için gerekli)
builder.Services.AddRazorPages();

// IdentityServer CORS (opsiyonel)
builder.Services.AddSingleton<ICorsPolicyService>(sp =>
{
    var logger = sp.GetRequiredService<ILogger<DefaultCorsPolicyService>>();
    return new DefaultCorsPolicyService(logger)
    {
        AllowedOrigins = { "https://localhost:7259", "https://localhost:5173" }
    };
});

var app = builder.Build();

if (!app.Environment.IsDevelopment()) app.UseHsts();
app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();
app.UseCors(CorsPolicy);

// GÜNCELLENDİ: DB migrate + seed işlemi retry mekanizması ile çağrılıyor.
await ApplyMigrationsWithRetry(app);

app.UseIdentityServer();
app.UseAuthorization();

app.MapRazorPages();

app.MapGet("/", () => "Blinkr IdentityServer running");

app.UseHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();


// YENİ EKLENEN METOT: Bu metot veritabanı hazır değilse bir süre bekleyip tekrar dener.
async Task ApplyMigrationsWithRetry(IApplicationBuilder app)
{
    var maxRetries = 10;
    var delay = TimeSpan.FromSeconds(5);
    var logger = app.ApplicationServices.GetRequiredService<ILogger<Program>>();

    for (int i = 0; i < maxRetries; i++)
    {
        try
        {
            logger.LogInformation("Veritabanı migration'ları uygulanıyor (Deneme {AttemptNumber})...", i + 1);

            using (var scope = app.ApplicationServices.CreateScope())
            {
                var usersDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await usersDb.Database.MigrateAsync();

                // Not: IdentitySeeder'ın HasData ile çakışmaması için koşullu kontrol içerdiğinden emin olunmalıdır.
                await IdentitySeeder.SeedAsync(usersDb);

                var persistedDb = scope.ServiceProvider.GetRequiredService<PersistedGrantDbContext>();
                await persistedDb.Database.MigrateAsync();

                logger.LogInformation("Migration'lar başarıyla uygulandı.");
                return; // Başarılı olursa fonksiyondan çık
            }
        }
        catch (NpgsqlException ex) when (i < maxRetries - 1) // Son denemede throw et
        {
            logger.LogWarning(ex, "Postgres bağlantı hatası (deneme {Attempt}/{MaxRetries}). {Delay} saniye bekleniyor...", 
                i + 1, maxRetries, delay.TotalSeconds);
            await Task.Delay(delay);
        }
        catch (Exception ex) when (i < maxRetries - 1)
        {
            logger.LogError(ex, "Migration sırasında beklenmedik hata (deneme {Attempt}/{MaxRetries}).", i + 1, maxRetries);
            await Task.Delay(delay);
        }
    }

    throw new Exception("Veritabanına birden fazla denemeden sonra bağlanılamadı.");
}