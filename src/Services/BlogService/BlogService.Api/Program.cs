using BlogService.Api;
using BlogService.Api.Auth;
using BlogService.Application.Services.Queries;
using BlogService.Infrastructure.Services;
using BlogService.Infrastructure.Services.Indexes;
using BlogService.Api.RateLimiting;
using BlogService.Api.Middleware;
using BlogService.Application.Common.Behaviors;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.Mappings;
using BlogService.Application.Validators.PostValidators;
using BlogService.Infrastructure;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Repositories;
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
using MongoDB.Bson;
using Serilog;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.HttpOverrides;
using StackExchange.Redis;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc.Versioning;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;
using Amazon.S3;
using BlogService.Api.Services;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

const string corsPolicyName = "BlinkrCors";
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                // Development
                "https://localhost:7259",
                "http://localhost:5215",
                // Android Emulator
                "http://10.0.2.2:5215",
                "http://10.0.2.2:7259",
                // iOS Simulator
                "http://localhost",
                "https://localhost",
                // Production (add your domains)
                "https://blinkr.app",
                "https://api.blinkr.app"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            // Expose rate limiting headers for mobile
            .WithExposedHeaders("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "Retry-After");
    });
});
builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreatePostDtoValidator>();
builder.Services.AddEndpointsApiExplorer();

// Rate Limiting Configuration
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    
    // Global rate limiter
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var deviceId = httpContext.Request.Headers["X-Device-Id"].ToString();
        var key = string.IsNullOrWhiteSpace(deviceId)
            ? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon"
            : $"dev:{deviceId}";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: key,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,                // 100 req / window
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });

    // Feed-specific rate limiter (more restrictive)
    options.AddPolicy("feed", httpContext =>
    {
        var deviceId = httpContext.Request.Headers["X-Device-Id"].ToString();
        var key = string.IsNullOrWhiteSpace(deviceId)
            ? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon"
            : $"dev:{deviceId}";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: key,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,                // 60 req / window for feed
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst
            });
    });
});

// API Versioning
builder.Services.AddApiVersioning(o =>
{
    o.AssumeDefaultVersionWhenUnspecified = true;
    o.DefaultApiVersion = new ApiVersion(1, 0);
    o.ReportApiVersions = true;
    o.ApiVersionReader = new UrlSegmentApiVersionReader();
});
builder.Services.AddVersionedApiExplorer(o =>
{
    o.GroupNameFormat = "'v'VVV";
    o.SubstituteApiVersionInUrl = true;
});
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Blinkr API", Version = "v1" });
    
    var authority = builder.Configuration["Auth:Authority"] ?? "https://localhost:7122";
    c.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Flows = new OpenApiOAuthFlows
        {
            AuthorizationCode = new OpenApiOAuthFlow
            {
                AuthorizationUrl = new Uri($"{authority}/connect/authorize"),
                TokenUrl = new Uri($"{authority}/connect/token"),
                Scopes = new Dictionary<string, string>
                {
                    ["blinkr_api"] = "Blinkr core API access",
                    ["blinkr.api.read"] = "Read access",
                    ["blinkr.api.write"] = "Write access",
                    ["openid"] = "OpenID",
                    ["profile"] = "Profile",
                    ["roles"] = "Roles",
                    ["offline_access"] = "Refresh token"
                }
            }
        }
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [ new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "oauth2" } } ] =
            new[] { "blinkr_api" }
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

// MongoDB İstemcisi (Read Handler'lar için) - Optimized// MongoDB Configuration with GUID serialization fix
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    // CRITICAL: Configure GUID serialization BEFORE creating client
    MongoDB.Bson.Serialization.BsonSerializer.RegisterSerializer(new MongoDB.Bson.Serialization.Serializers.GuidSerializer(GuidRepresentation.Standard));
    
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
    // Use a factory to get the multiplexer when needed
    options.ConnectionMultiplexerFactory = () =>
    {
        var connectionString = builder.Configuration.GetConnectionString("Redis");
        var configOptions = ConfigurationOptions.Parse(connectionString ?? "");
        configOptions.AbortOnConnectFail = false;
        configOptions.ConnectRetry = 3;
        configOptions.SyncTimeout = 2000;
        configOptions.AsyncTimeout = 5000;
        configOptions.ReconnectRetryPolicy = new ExponentialRetry(1000);
        return Task.FromResult<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(configOptions));
    };
});

// Rate Limiting Services
builder.Services.Configure<RateLimitingOptions>(builder.Configuration.GetSection("RateLimiting"));
builder.Services.AddSingleton<ITokenBucketLimiter, RedisTokenBucketLimiter>();
builder.Services.AddSingleton<RateLimitingMetrics>();
builder.Services.AddTransient<RateLimitingMiddleware>();

// Forwarded Headers for proxy scenarios (Kubernetes/Nginx/etc.)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
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
builder.Services.AddScoped<BlogService.Infrastructure.Services.PostQueryService>();
builder.Services.AddScoped<BlogService.Application.Services.Queries.IPostQueryService>(sp =>
{
    var inner = sp.GetRequiredService<BlogService.Infrastructure.Services.PostQueryService>();
    var cache = sp.GetRequiredService<IDistributedCache>();
    var logger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Services.CachedPostQueryService>>();
    return new BlogService.Infrastructure.Services.CachedPostQueryService(inner, cache, logger);
});

// MongoDB Index Service
builder.Services.AddScoped<BlogService.Infrastructure.Services.Indexes.MongoIndexService>();

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
    Serilog.Log.Information("🔔 EventStore subscription ENABLED");
}
else
{
    Serilog.Log.Information("🔕 EventStore subscription DISABLED - using decorator pattern");
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
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy()) // liveness
    .AddMongoDb(sp => sp.GetRequiredService<IMongoClient>(), name: "mongo", tags: new[] { "ready" })
    .AddRedis(builder.Configuration.GetConnectionString("Redis") ?? "", name: "redis", tags: new[] { "ready" })
    .AddRabbitMQ(builder.Configuration.GetConnectionString("RabbitMq") ?? "", name: "rabbitmq", tags: new[] { "ready" })
    .AddCheck<BlogService.Infrastructure.Geocoding.GeocodingHealthCheck>("geocoding", tags: new[] { "ready" });

// Response Compression (gzip/brotli) for better performance
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "application/json",
        "text/json"
    });
});

// Response caching middleware
builder.Services.AddResponseCaching();

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Optimal;
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Optimal;
});

// Object Storage Configuration (S3)
builder.Services.AddSingleton<IAmazonS3>(sp =>
{
    var config = new AmazonS3Config
    {
        RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(builder.Configuration["AWS:Region"] ?? "us-east-1"),
        ServiceURL = builder.Configuration["AWS:S3ServiceUrl"] // For local development with LocalStack
    };
    return new AmazonS3Client(config);
});

builder.Services.AddScoped<IObjectStorage>(sp =>
{
    var s3 = sp.GetRequiredService<IAmazonS3>();
    var bucket = builder.Configuration["AWS:S3Bucket"] ?? "blinkr-media";
    var logger = sp.GetRequiredService<ILogger<S3Storage>>();
    return new S3Storage(s3, bucket, logger);
});

// OpenTelemetry Configuration
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("BlogService.Api"))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter())            // OTLP->Grafana Tempo/Jaeger
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        // .AddRuntimeInstrumentation() // Not available in this version
        .AddPrometheusExporter());     // Prometheus scrape

var app = builder.Build();

// ===== ENSURE MONGODB INDEXES =====
using (var scope = app.Services.CreateScope())
{
    try
    {
        var indexService = scope.ServiceProvider.GetRequiredService<BlogService.Infrastructure.Services.Indexes.MongoIndexService>();
        await indexService.EnsureIndexesAsync();
        
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogInformation("🗺️ MongoDB indexes initialized successfully");
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "❌ Failed to initialize MongoDB indexes");
        // Don't throw - let app start anyway
    }
}

// ---- Pipeline ----
app.UseSerilogRequestLogging();

// Request-Id middleware for correlation
app.Use(async (ctx, next) =>
{
    var rid = ctx.Request.Headers["X-Request-Id"].ToString();
    if (string.IsNullOrWhiteSpace(rid)) rid = Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
    ctx.Response.Headers["Request-Id"] = rid;
    ctx.Items["RequestId"] = rid;
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(o =>
    {
        o.SwaggerEndpoint("/swagger/v1/swagger.json", "Blinkr API v1");
        o.OAuthClientId("swagger-ui");
        o.OAuthUsePkce();               // 🔑 PKCE
        o.OAuthScopes("blinkr_api");
    });
}
app.UseForwardedHeaders(); // Handle proxy headers FIRST
app.UseHttpsRedirection();
app.UseResponseCompression(); // Enable compression middleware
app.UseResponseCaching(); // Enable response caching middleware

// Device headers middleware for telemetry
app.UseMiddleware<DeviceHeadersMiddleware>();

// Rate limiting BEFORE authentication (IP-based protection)
app.UseMiddleware<RateLimitingMiddleware>();
app.UseRateLimiter();

app.UseCors(corsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Health check endpoints
app.MapHealthChecks("/health/liveness", new HealthCheckOptions
{
    Predicate = r => r.Name == "self"
});

app.MapHealthChecks("/health/readiness", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

// Prometheus metrics endpoint
app.MapPrometheusScrapingEndpoint("/metrics");

app.Run();

