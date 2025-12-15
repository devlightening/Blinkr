using BlogService.Api;
using BlogService.Api.Auth;
using BlogService.Application.Services;
using BlogService.Application.Services.Queries;
using BlogService.Infrastructure.Services;
using BlogService.Infrastructure.Services.Queries;
using BlogService.Infrastructure.Services.Indexes;
using S3Storage = BlogService.Infrastructure.Services.S3Storage;
using BlogService.Api.RateLimiting;
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
using System.Text;
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
using Amazon.S3.Model;
using System.Diagnostics;
using BlogService.Api.Middlewares;

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
            .WithExposedHeaders("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "Retry-After");
    });
});

builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration).WriteTo.Console());

builder.Services.AddHttpContextAccessor();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

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
                PermitLimit = 100, // 100 req / window
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
                PermitLimit = 60, // 60 req / window for feed
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

// Swagger – Bearer JWT
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Blinkr API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "JWT: Bearer {token}",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// --- SERVİS KAYITLARI ---

builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

// PostgreSQL DbContext
builder.Services.AddDbContext<BlogDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("BlogDb")));

// EventStoreDB Client
builder.Services.AddSingleton<EventStoreClient>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("EventStore");
    if (string.IsNullOrEmpty(connectionString))
        throw new InvalidOperationException("EventStore connection string not configured.");
    
    Serilog.Log.Information("📡 EventStore connection string: {ConnectionString}", connectionString);
    
    var settings = EventStoreClientSettings.Create(connectionString);
    var client = new EventStoreClient(settings);
    
    // Quick connectivity test (fire & forget)
    _ = Task.Run(async () =>
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            await client.ReadAllAsync(Direction.Forwards, Position.Start, 1, cancellationToken: cts.Token)
                        .FirstOrDefaultAsync(cts.Token);
            Serilog.Log.Information("✅ EventStore connectivity check OK");
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "❌ EventStore connectivity check FAILED");
        }
    });
    
    return client;
});

// MongoDB Client (with GUID fix)
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    MongoDB.Bson.Serialization.BsonSerializer.RegisterSerializer(
        new MongoDB.Bson.Serialization.Serializers.GuidSerializer(GuidRepresentation.Standard));

    var connectionString = builder.Configuration.GetConnectionString("MongoDb");

    var settings = MongoClientSettings.FromConnectionString(connectionString);
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
    if (string.IsNullOrEmpty(dbName))
        throw new InvalidOperationException("MongoDB DatabaseName is not configured.");
    return client.GetDatabase(dbName);
});

// Redis Cache
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var connectionString = builder.Configuration.GetConnectionString("Redis");
    var options = ConfigurationOptions.Parse(connectionString);

    options.AbortOnConnectFail = false;
    options.ConnectRetry = 3;
    options.SyncTimeout = 2000;
    options.AsyncTimeout = 5000;
    options.ReconnectRetryPolicy = new ExponentialRetry(1000);

    return ConnectionMultiplexer.Connect(options);
});

builder.Services.AddStackExchangeRedisCache(options =>
{
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

// Forwarded Headers
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddSingleton<ICheckpointStore, MongoCheckpointStore>();

// Repository registrations
builder.Services.AddScoped<EventStoreDbRepository>();
builder.Services.AddScoped<IEventStoreRepository>(sp =>
{
    var inner = sp.GetRequiredService<EventStoreDbRepository>();
    var bus = sp.GetRequiredService<IBus>();
    var dbContext = sp.GetRequiredService<BlogDbContext>();
    var logger = sp.GetRequiredService<ILogger<EventStorePublishingDecorator>>();
    return new EventStorePublishingDecorator(inner, bus, dbContext, logger);
});
builder.Services.AddScoped<IPostReadRepository, PostReadRepository>();

// Query services (SOLID: each service handles one concern)
builder.Services.AddScoped<PostFeedQueryService>();
builder.Services.AddScoped<PostSearchQueryService>();
builder.Services.AddScoped<PostNearbyQueryService>();

// Register CachedPostQueryService as IPostQueryService
builder.Services.AddScoped<IPostQueryService, CachedPostQueryService>();

// Maintenance service for read model sync
builder.Services.AddScoped<IPostMaintenanceService, PostMaintenanceService>();
builder.Services.AddScoped<IPostReadModelSyncService, PostReadModelSyncService>();

// MongoDB Index Service
builder.Services.AddScoped<BlogService.Infrastructure.Services.Indexes.MongoIndexService>();

// Geocoding configuration
builder.Services.Configure<BlogService.Infrastructure.Geocoding.NominatimOptions>(
    builder.Configuration.GetSection("Geocoding"));

builder.Services.Configure<BlogService.Infrastructure.Geocoding.NowFeedOptions>(
    builder.Configuration.GetSection("NowFeed"));

// Nominatim HttpClient
builder.Services.AddHttpClient<BlogService.Infrastructure.Geocoding.NominatimGeocodingService>((sp, c) =>
{
    var options = sp.GetRequiredService<
        Microsoft.Extensions.Options.IOptions<BlogService.Infrastructure.Geocoding.NominatimOptions>>().Value;
    c.BaseAddress = new Uri(options.BaseUrl);
    c.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
    c.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
    c.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});

// Concurrency Gate
builder.Services.AddSingleton(sp =>
{
    var maxConcurrency = builder.Configuration.GetValue<int>("Geocoding:MaxConcurrency", 2);
    return new SemaphoreSlim(maxConcurrency, maxConcurrency);
});

// Geocoding service chain
builder.Services.AddScoped<BlogService.Application.Services.IGeocodingService>(sp =>
{
    var nominatim = sp.GetRequiredService<BlogService.Infrastructure.Geocoding.NominatimGeocodingService>();

    var gate = sp.GetRequiredService<SemaphoreSlim>();
    var constrainedLogger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Geocoding.ConstrainedGeocodingService>>();
    var constrained = new BlogService.Infrastructure.Geocoding.ConstrainedGeocodingService(nominatim, gate, constrainedLogger);

    var cache = sp.GetRequiredService<IDistributedCache>();
    var cachingLogger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Geocoding.CachingGeocodingService>>();
    var ttlHours = builder.Configuration.GetValue<int>("Geocoding:CacheTtlHours", 24);

    return new BlogService.Infrastructure.Geocoding.CachingGeocodingService(
        cache, constrained, cachingLogger, TimeSpan.FromHours(ttlHours));
});

// EventStore subscription
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

// MassTransit
builder.Services.AddMassTransit(busConfig =>
{
    busConfig.UsingRabbitMq((context, cfg) =>
    {
        var rabbitMqConfig = builder.Configuration.GetSection("RabbitMq");
        cfg.Host(rabbitMqConfig["Host"], "/", h =>
        {
            h.Username("user");
            h.Password("password");
        });
    });
});

// Diğer servisler
builder.Services.AddSingleton<IAuthorizationHandler, OwnerOrAdminHandler>();
builder.Services.AddAutoMapper(cfg => cfg.AddProfile<PostMappingProfile>());
builder.Services.AddMediatR(cfg =>
    cfg.RegisterServicesFromAssembly(Assembly.Load("BlogService.Application")));
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

// === JWT AUTH: IdentityService HS256 token doğrulama ===
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtIssuer = jwtSection["Issuer"] ?? "https://localhost:7297";
var jwtAudience = jwtSection["Audience"] ?? "blinkr.api";
var jwtKey = jwtSection["Key"];

if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException("Jwt:Key is not configured. Check appsettings.Development.json.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.RequireHttpsMetadata = false; // dev

        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,

            ValidateAudience = true,
            ValidAudience = jwtAudience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),

            NameClaimType = "sub",
            RoleClaimType = "role"
        };

        o.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                Console.WriteLine($"[JWT FAILED] {ctx.Exception.Message}");
                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsync("{\"error\":\"Unauthorized\"}");
            }
        };
    });

// Authorization
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("api.read", policy =>
        policy.RequireAuthenticatedUser());

    options.AddPolicy("api.write", policy =>
        policy.RequireAuthenticatedUser());

    options.AddPolicy("AdminOnly", policy =>
        policy.RequireAuthenticatedUser()
              .RequireRole("Admin"));

    options.DefaultPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.FallbackPolicy = options.DefaultPolicy;
});

// HealthChecks
builder.Services.AddHealthChecks()
    .AddCheck("self", () =>
        Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy())
    .AddMongoDb(sp => sp.GetRequiredService<IMongoClient>(), name: "mongo", tags: new[] { "ready" })
    .AddRedis(builder.Configuration.GetConnectionString("Redis") ?? "", name: "redis", tags: new[] { "ready" })
    .AddRabbitMQ(builder.Configuration.GetConnectionString("RabbitMq") ?? "", name: "rabbitmq", tags: new[] { "ready" })
    .AddCheck<BlogService.Infrastructure.Geocoding.GeocodingHealthCheck>("geocoding", tags: new[] { "ready" });

// Response Compression
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

builder.Services.AddResponseCaching();

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});

// Object Storage (S3)
builder.Services.AddSingleton<IAmazonS3>(sp =>
{
    var config = new AmazonS3Config
    {
        RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(
            builder.Configuration["AWS:Region"] ?? "us-east-1"),
        ServiceURL = builder.Configuration["AWS:S3ServiceUrl"]
    };
    return new AmazonS3Client(config);
});

// S3Storage registration (Infrastructure layer)
builder.Services.AddScoped<IObjectStorage>(sp =>
{
    var s3 = sp.GetRequiredService<IAmazonS3>();
    var bucket = builder.Configuration["AWS:S3Bucket"] ?? "blinkr-media";
    var logger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Services.S3Storage>>();
    return new S3Storage(s3, bucket, logger);
});

// OpenTelemetry
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("BlogService.Api"))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter())
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddPrometheusExporter());

var app = builder.Build();

// MongoDB index ensure
using (var scope = app.Services.CreateScope())
{
    var indexService = scope.ServiceProvider.GetRequiredService<BlogService.Infrastructure.Services.Indexes.MongoIndexService>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        await indexService.EnsureIndexesAsync();
        logger.LogInformation("🗺️ MongoDB indexes initialized successfully");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "❌ Failed to initialize MongoDB indexes");
        throw;
    }
}

// Pipeline
app.UseSerilogRequestLogging();

// Request-Id middleware
app.Use(async (ctx, next) =>
{
    var rid = ctx.Request.Headers["X-Request-Id"].ToString();
    if (string.IsNullOrWhiteSpace(rid))
        rid = Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
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
        // Sadece Bearer token kullanılacak, OAuth2 yok.
    });
}

app.UseForwardedHeaders();

if (app.Environment.IsProduction())
{
    app.UseHttpsRedirection();
}

app.UseResponseCompression();
app.UseResponseCaching();

app.UseMiddleware<DeviceHeadersMiddleware>();

app.UseMiddleware<RateLimitingMiddleware>();
app.UseRateLimiter();

app.UseCors(corsPolicyName);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health endpoints
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = _ => true
}).AllowAnonymous();

app.MapHealthChecks("/health/liveness", new HealthCheckOptions
{
    Predicate = r => r.Name == "self"
}).AllowAnonymous();

app.MapHealthChecks("/health/readiness", new HealthCheckOptions
{
    Predicate = r => r.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
}).AllowAnonymous();

// Prometheus metrics
app.MapPrometheusScrapingEndpoint("/metrics");

app.Run();
