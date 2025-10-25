using BlogService.Api;
using BlogService.Api.Auth;
using BlogService.Api.Services;
using BlogService.Application.Common.Behaviors;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.Mappings;
using BlogService.Application.Validators.PostValidators;
using BlogService.Infrastructure;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Repositories;
using BlogService.Infrastructure.Services;
using EventStore.Client;
using FluentValidation;
using FluentValidation.AspNetCore;
using HealthChecks.UI.Client;
using MassTransit;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MongoDB.Driver;
using Serilog;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

const string corsPolicyName = "BlinkrCors";
builder.Services.AddCors(o =>
{
    o.AddPolicy(corsPolicyName, p =>
    {
        p.WithOrigins("https://localhost:7259", "https://localhost:5173").AllowAnyHeader().AllowAnyMethod();
    });
});
builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreatePostDtoValidator>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "BlogService.Api", Version = "v1" });
    c.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Flows = new OpenApiOAuthFlows
        {
            Password = new OpenApiOAuthFlow
            {
                TokenUrl = new Uri("https://localhost:7122/connect/token"),
                Scopes = new Dictionary<string, string> {
                    {"blinkr.api.read","Read"}, {"blinkr.api.write","Write"},
                    {"openid","OpenID"}, {"profile","Profile"}, {"roles","Roles"},
                    {"offline_access","Refresh token"}
                }
            }
        }
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement{
        { new OpenApiSecurityScheme{
            Reference = new OpenApiReference{ Type = ReferenceType.SecurityScheme, Id = "oauth2"} },
            new []{ "blinkr.api.read","blinkr.api.write" } }
    });
});

// --- SERVİS KAYITLARI (TAM VE DÜZELTİLMİŞ) ---

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// PostgreSQL DbContext (Sadece eski Read Model ve gerekirse diğer tablolar için)
builder.Services.AddDbContext<BlogDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("BlogDb")));

// EventStoreDB İstemcisi
builder.Services.AddSingleton<EventStoreClient>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("EventStore");
    if (string.IsNullOrEmpty(connectionString)) throw new InvalidOperationException("EventStore connection string not configured.");
    var settings = EventStoreClientSettings.Create(connectionString);
    return new EventStoreClient(settings);
});

// MongoDB İstemcisi (Read Handler'lar için) - Optimized connection pooling
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("MongoDb");
    var settings = MongoClientSettings.FromConnectionString(connectionString);
    
    // Connection pooling optimization
    settings.MaxConnectionPoolSize = 200;
    settings.MinConnectionPoolSize = 10;
    settings.ConnectTimeout = TimeSpan.FromSeconds(10);
    settings.WaitQueueTimeout = TimeSpan.FromSeconds(5);
    settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
    settings.WriteConcern = WriteConcern.WMajority;
    
    return new MongoClient(settings);
});
builder.Services.AddSingleton<IMongoDatabase>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    var dbName = builder.Configuration["MongoDbSettings:DatabaseName"];
    if (string.IsNullOrEmpty(dbName)) throw new InvalidOperationException("MongoDB DatabaseName is not configured.");
    return client.GetDatabase(dbName);
});

// Redis Cache (IDistributedCache için) - Optimized connection multiplexer
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("Redis");
    var options = ConfigurationOptions.Parse(connectionString);
    
    // Connection resiliency optimization
    options.AbortOnConnectFail = false;
    options.ConnectRetry = 3;
    options.SyncTimeout = 2000;
    options.AsyncTimeout = 5000;
    options.ReconnectRetryPolicy = new ExponentialRetry(1000);
    
    return ConnectionMultiplexer.Connect(options);
});

builder.Services.AddStackExchangeRedisCache(options =>
{
    var multiplexer = builder.Services.BuildServiceProvider().GetRequiredService<IConnectionMultiplexer>();
    options.ConnectionMultiplexerFactory = () => Task.FromResult(multiplexer);
});

builder.Services.AddSingleton<ICheckpointStore, MongoCheckpointStore>();

// Repository Kayıtları
builder.Services.AddScoped<EventStoreDbRepository>(); // Inner repository
builder.Services.AddScoped<IEventStoreRepository>(sp =>
{
    var inner = sp.GetRequiredService<EventStoreDbRepository>();
    var bus = sp.GetRequiredService<IBus>();
    var logger = sp.GetRequiredService<ILogger<EventStorePublishingDecorator>>();
    return new EventStorePublishingDecorator(inner, bus, logger);
});
builder.Services.AddScoped<IPostReadRepository, PostReadRepository>();

// Query Service (MongoDB Read Model) with Redis caching
builder.Services.AddScoped<PostQueryService>();
builder.Services.AddScoped<IPostQueryService>(sp =>
{
    var inner = sp.GetRequiredService<PostQueryService>();
    var cache = sp.GetRequiredService<IDistributedCache>();
    var logger = sp.GetRequiredService<ILogger<CachedPostQueryService>>();
    return new CachedPostQueryService(inner, cache, logger);
});

// ---- Geocoding Configuration ----
builder.Services.Configure<BlogService.Infrastructure.Geocoding.NominatimOptions>(
    builder.Configuration.GetSection("Geocoding"));

// ---- Nominatim HttpClient (without Polly for now) ----
builder.Services.AddHttpClient<BlogService.Infrastructure.Geocoding.NominatimGeocodingService>((sp, c) =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<BlogService.Infrastructure.Geocoding.NominatimOptions>>().Value;
    c.BaseAddress = new Uri(options.BaseUrl);
    c.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
    c.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
    c.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});

// ---- Concurrency Gate ----
builder.Services.AddSingleton(sp =>
{
    var maxConcurrency = builder.Configuration.GetValue<int>("Geocoding:MaxConcurrency", 2);
    return new SemaphoreSlim(maxConcurrency, maxConcurrency);
});

// ---- Geocoding Service Chain (Nominatim → Constrained → Cached) ----
builder.Services.AddScoped<BlogService.Application.Services.IGeocodingService>(sp =>
{
    // Inner service: Nominatim
    var nominatim = sp.GetRequiredService<BlogService.Infrastructure.Geocoding.NominatimGeocodingService>();
    
    // Concurrency constraint
    var gate = sp.GetRequiredService<SemaphoreSlim>();
    var constrainedLogger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Geocoding.ConstrainedGeocodingService>>();
    var constrained = new BlogService.Infrastructure.Geocoding.ConstrainedGeocodingService(nominatim, gate, constrainedLogger);
    
    // Caching decorator
    var cache = sp.GetRequiredService<IDistributedCache>();
    var cachingLogger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Geocoding.CachingGeocodingService>>();
    var ttlHours = builder.Configuration.GetValue<int>("Geocoding:CacheTtlHours", 24);
    
    return new BlogService.Infrastructure.Geocoding.CachingGeocodingService(
        cache, constrained, cachingLogger, TimeSpan.FromHours(ttlHours));
});

// EventStoreDB subscription - conditional registration based on configuration
var enableSubscription = builder.Configuration.GetValue<bool>("EventStore:EnableSubscription");
if (enableSubscription)
{
    builder.Services.AddHostedService<EventStoreToRabbitMqPublisher>();
    Log.Information("🔔 EventStore subscription ENABLED");
}
else
{
    Log.Information("🔕 EventStore subscription DISABLED - using decorator pattern");
}

// MassTransit (Sadece Yayıncı olarak ayarlandı)
builder.Services.AddMassTransit(busConfig =>
{
    busConfig.UsingRabbitMq((context, cfg) =>
    {
        var rabbitMqConfig = builder.Configuration.GetSection("RabbitMq");
        cfg.Host(rabbitMqConfig["Host"], "/", h => {
            h.Username("user");
            h.Password("password");
        });
    });
});

// Diğer Servisler
builder.Services.AddSingleton<IAuthorizationHandler, OwnerOrAdminHandler>();
builder.Services.AddAutoMapper(cfg => cfg.AddProfile<PostMappingProfile>());
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.Load("BlogService.Application")));
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

var issuer = "https://localhost:7122";
var audience = "blinkr.api";
var publicPemPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "IdentityServerService", "IdentityServerService", "keys", "rsa-public.pem"));
if (!File.Exists(publicPemPath)) throw new FileNotFoundException($"Public key not found: {publicPemPath}");
var publicPem = File.ReadAllText(publicPemPath);
var rsa = RSA.Create();
rsa.ImportFromPem(publicPem);
var rsaKey = new RsaSecurityKey(rsa) { KeyId = "blinkr-dev-key" };
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = issuer,
        ValidateAudience = true,
        ValidAudiences = new[] { audience, $"{issuer}/resources" },
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = rsaKey,
        NameClaimType = "sub",
        RoleClaimType = "role"
    };
});
builder.Services.AddAuthorization(options =>
{
    // API Policies with scope requirements
    options.AddPolicy("api.read", policy => 
        policy.RequireAuthenticatedUser()
              .RequireClaim("scope", "blinkr.api.read"));
              
    options.AddPolicy("api.write", policy => 
        policy.RequireAuthenticatedUser()
              .RequireClaim("scope", "blinkr.api.write"));
              
    options.AddPolicy("AdminOnly", policy => 
        policy.RequireAuthenticatedUser()
              .RequireRole("Admin"));
    
    // Default policy - require authentication for all endpoints
    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
        
    // Fallback policy - apply to endpoints without explicit [Authorize] or [AllowAnonymous]
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});
builder.Services.AddHealthChecks()
    .AddCheck<BlogService.Infrastructure.Geocoding.GeocodingHealthCheck>("geocoding");

// Response Compression (gzip/brotli) for better performance
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
    options.Providers.Add<BrotliCompressionProvider>();
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Optimal;
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Optimal;
});

var app = builder.Build();

// ---- Pipeline ----
app.UseSerilogRequestLogging();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseHttpsRedirection();
app.UseResponseCompression(); // Enable compression middleware
app.UseCors(corsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse })
   .AllowAnonymous(); // Health check should be public

app.Run();

