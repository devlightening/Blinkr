using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using BlogService.Api.Auth;
using BlogService.Api.RateLimiting;
using BlogService.Application.Common.Behaviors;
using BlogService.Application.Common.Interfaces;
using BlogService.Application.Mappings;
using BlogService.Application.Services;
using BlogService.Application.Services.Queries;
using BlogService.Application.Validators.PostValidators;
using BlogService.Infrastructure;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Repositories;
using BlogService.Infrastructure.Services;
using BlogService.Infrastructure.Services.Queries;
using EventStore.Client;
using FluentValidation;
using FluentValidation.AspNetCore;
using MassTransit;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Versioning;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MongoDB.Bson;
using MongoDB.Driver;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Shared.Auth;
using StackExchange.Redis;

namespace BlogService.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddBlogCors(this IServiceCollection services, string policyName)
    {
        services.AddCors(options =>
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

        return services;
    }

    public static IServiceCollection AddBlogControllers(this IServiceCollection services)
    {
        services.AddHttpContextAccessor();

        services.AddControllers()
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        services.AddFluentValidationAutoValidation();
        services.AddValidatorsFromAssemblyContaining<CreatePostDtoValidator>();
        services.AddEndpointsApiExplorer();

        return services;
    }

    public static IServiceCollection AddBlogRateLimiting(this IServiceCollection services, IConfiguration config)
    {
        // Production default stays 100 requests/minute per device or IP. It can be raised through
        // configuration (RateLimiting:GlobalPermitLimit) for controlled runs such as load or seed tests;
        // callers must not be able to raise it themselves.
        var globalPermitLimit = Math.Max(1, config.GetValue<int?>("RateLimiting:GlobalPermitLimit") ?? 100);

        services.AddRateLimiter(options =>
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
                        PermitLimit = globalPermitLimit, // 100 req / window unless configured
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

        services.Configure<RateLimitingOptions>(config.GetSection("RateLimiting"));
        services.AddSingleton<ITokenBucketLimiter, RedisTokenBucketLimiter>();
        services.AddSingleton<RateLimitingMetrics>();
        services.AddTransient<RateLimitingMiddleware>();

        return services;
    }

    public static IServiceCollection AddBlogApiVersioning(this IServiceCollection services)
    {
        services.AddApiVersioning(o =>
        {
            o.AssumeDefaultVersionWhenUnspecified = true;
            o.DefaultApiVersion = new ApiVersion(1, 0);
            o.ReportApiVersions = true;
            o.ApiVersionReader = new UrlSegmentApiVersionReader();
        });
        services.AddVersionedApiExplorer(o =>
        {
            o.GroupNameFormat = "'v'VVV";
            o.SubstituteApiVersionInUrl = true;
        });

        return services;
    }

    public static IServiceCollection AddBlogSwagger(this IServiceCollection services)
    {
        services.AddSwaggerGen(c =>
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

        return services;
    }

    public static IServiceCollection AddBlogDataStores(this IServiceCollection services, IConfiguration config)
    {
        // PostgreSQL DbContext
        services.AddDbContext<BlogDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("BlogDb")));

        // EventStoreDB Client
        services.AddSingleton<EventStoreClient>(sp =>
        {
            var connectionString = config.GetConnectionString("EventStore");
            if (string.IsNullOrEmpty(connectionString))
                throw new InvalidOperationException("EventStore connection string not configured.");

            Serilog.Log.Information("📡 EventStore connection string: {ConnectionString}", connectionString);

            var settings = EventStoreClientSettings.Create(connectionString);
            settings.DefaultDeadline = TimeSpan.FromSeconds(config.GetValue("EventStore:DefaultDeadlineSeconds", 15));
            var client = new EventStoreClient(settings);

            // Quick connectivity test (fire & forget)
            _ = Task.Run(async () =>
            {
                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                    await System.Linq.AsyncEnumerable.FirstOrDefaultAsync(
                        client.ReadAllAsync(Direction.Forwards, Position.Start, 1, cancellationToken: cts.Token),
                        cts.Token);
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
        services.AddSingleton<IMongoClient>(sp =>
        {
            MongoDB.Bson.Serialization.BsonSerializer.RegisterSerializer(
                new MongoDB.Bson.Serialization.Serializers.GuidSerializer(GuidRepresentation.Standard));

            var connectionString = config.GetConnectionString("MongoDb");

            var settings = MongoClientSettings.FromConnectionString(connectionString);
            settings.MaxConnectionPoolSize = 200;
            settings.MinConnectionPoolSize = 10;
            settings.ConnectTimeout = TimeSpan.FromSeconds(10);
            settings.WaitQueueTimeout = TimeSpan.FromSeconds(5);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
            settings.WriteConcern = WriteConcern.WMajority;

            return new MongoClient(settings);
        });

        services.AddSingleton<IMongoDatabase>(sp =>
        {
            var client = sp.GetRequiredService<IMongoClient>();
            var dbName = config["MongoDbSettings:DatabaseName"];
            if (string.IsNullOrEmpty(dbName))
                throw new InvalidOperationException("MongoDB DatabaseName is not configured.");
            return client.GetDatabase(dbName);
        });

        // Redis Cache
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var connectionString = config.GetConnectionString("Redis");
            var options = ConfigurationOptions.Parse(connectionString ?? string.Empty);

            options.AbortOnConnectFail = false;
            options.ConnectRetry = 3;
            options.SyncTimeout = 2000;
            options.AsyncTimeout = 5000;
            options.ReconnectRetryPolicy = new ExponentialRetry(1000);

            return ConnectionMultiplexer.Connect(options);
        });

        services.AddStackExchangeRedisCache(options =>
        {
            options.ConnectionMultiplexerFactory = () =>
            {
                var connectionString = config.GetConnectionString("Redis");
                var configOptions = ConfigurationOptions.Parse(connectionString ?? "");
                configOptions.AbortOnConnectFail = false;
                configOptions.ConnectRetry = 3;
                configOptions.SyncTimeout = 2000;
                configOptions.AsyncTimeout = 5000;
                configOptions.ReconnectRetryPolicy = new ExponentialRetry(1000);
                return Task.FromResult<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(configOptions));
            };
        });

        services.AddSingleton<ICheckpointStore, MongoCheckpointStore>();

        return services;
    }

    public static IServiceCollection AddBlogRepositoriesAndServices(this IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // Repository registrations
        // BLK-INFRA-01: authoritative writes go only to EventStoreDB. Integration events
        // are published by EventStoreToRabbitMqPublisher after durable checkpointing.
        services.AddScoped<IEventStoreRepository, EventStoreDbRepository>();
        services.AddScoped<IPostReadRepository, PostReadRepository>();

        // Query services (SOLID: each service handles one concern)
        services.AddScoped<PostFeedQueryService>();
        services.AddScoped<PostSearchQueryService>();
        services.AddScoped<PostNearbyQueryService>();

        // Register CachedPostQueryService as IPostQueryService
        services.AddScoped<IPostQueryService, CachedPostQueryService>();

        // Maintenance service for read model sync
        services.AddScoped<IPostMaintenanceService, PostMaintenanceService>();
        services.AddScoped<IPostReadModelSyncService, PostReadModelSyncService>();

        // MongoDB Index Service
        services.AddScoped<BlogService.Infrastructure.Services.Indexes.MongoIndexService>();

        // Geocoding configuration
        services.Configure<BlogService.Infrastructure.Geocoding.NominatimOptions>(
            config.GetSection("Geocoding"));

        services.Configure<BlogService.Infrastructure.Geocoding.NowFeedOptions>(
            config.GetSection("NowFeed"));

        // Nominatim HttpClient
        services.AddHttpClient<BlogService.Infrastructure.Geocoding.NominatimGeocodingService>((sp, c) =>
        {
            var options = sp.GetRequiredService<
                Microsoft.Extensions.Options.IOptions<BlogService.Infrastructure.Geocoding.NominatimOptions>>().Value;
            c.BaseAddress = new Uri(options.BaseUrl);
            c.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            c.DefaultRequestHeaders.UserAgent.ParseAdd(options.UserAgent);
            c.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        });

        // Concurrency Gate
        services.AddSingleton(sp =>
        {
            var maxConcurrency = config.GetValue<int>("Geocoding:MaxConcurrency", 2);
            return new SemaphoreSlim(maxConcurrency, maxConcurrency);
        });

        // Geocoding service chain
        services.AddScoped<BlogService.Application.Services.IGeocodingService>(sp =>
        {
            var nominatim = sp.GetRequiredService<BlogService.Infrastructure.Geocoding.NominatimGeocodingService>();

            var gate = sp.GetRequiredService<SemaphoreSlim>();
            var constrainedLogger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Geocoding.ConstrainedGeocodingService>>();
            var constrained = new BlogService.Infrastructure.Geocoding.ConstrainedGeocodingService(nominatim, gate, constrainedLogger);

            var cache = sp.GetRequiredService<IDistributedCache>();
            var cachingLogger = sp.GetRequiredService<ILogger<BlogService.Infrastructure.Geocoding.CachingGeocodingService>>();
            var ttlHours = config.GetValue<int>("Geocoding:CacheTtlHours", 24);

            return new BlogService.Infrastructure.Geocoding.CachingGeocodingService(
                cache, constrained, cachingLogger, TimeSpan.FromHours(ttlHours));
        });

        services.AddHttpContextAccessor();
        services.AddHttpClient<BlogService.Api.Services.SocialGraphClient>(client =>
        {
            client.BaseAddress = new Uri((config["Services:IdentityBaseUrl"] ?? "http://localhost:5188").TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(3);
        });
        services.AddHttpClient<BlogService.Api.Services.ProfileVisibilityGuard>(client =>
        {
            client.BaseAddress = new Uri((config["Services:IdentityBaseUrl"] ?? "http://localhost:5188").TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(3);
        });

        services.AddHttpClient<IPlaceLookupService, BlogService.Api.Services.HttpPlaceLookupService>(client =>
        {
            client.BaseAddress = new Uri(config["PlaceService:BaseUrl"] ?? "http://localhost:5225");
            client.Timeout = TimeSpan.FromSeconds(3);
        });

        services.Configure<BlogService.Api.Services.MediaOptions>(
            config.GetSection("Media"));
        services.Configure<BlogService.Application.Services.PlaceProximityOptions>(
            config.GetSection("PlaceProximity"));
        services.AddSingleton<BlogService.Application.Services.IPlaceProximityPolicy, BlogService.Application.Services.PlaceProximityPolicy>();
        services.AddScoped<BlogService.Application.Services.IMediaAttachmentService, BlogService.Api.Services.MediaAttachmentService>();
        services.AddHostedService<BlogService.Api.Services.MediaCleanupService>();

        return services;
    }

    public static IServiceCollection AddBlogMessaging(this IServiceCollection services, IConfiguration config)
    {
        // EventStore subscription
        var enableSubscription = config.GetValue("EventStore:EnableSubscription", true);
        if (enableSubscription)
        {
            services.AddHostedService<BlogService.Api.EventStoreToRabbitMqPublisher>();
            Serilog.Log.Information("🔔 EventStore subscription ENABLED");
        }
        else
        {
            Serilog.Log.Information("🔕 EventStore subscription DISABLED - using decorator pattern");
        }

        // MassTransit
        services.AddMassTransit(busConfig =>
        {
            // plan-devam F3: a deleted account's signals, comments, likes, views and media are erased here.
            busConfig.AddConsumer<BlogService.Api.Consumers.UserDeletedConsumer>();
            busConfig.UsingRabbitMq((context, cfg) =>
            {
                var rabbitMqConfig = config.GetSection("RabbitMq");
                cfg.Host(rabbitMqConfig["Host"], "/", h =>
                {
                    h.Username("user");
                    h.Password("password");
                });
                cfg.ReceiveEndpoint("blog-service-user-deleted", e =>
                {
                    e.UseMessageRetry(r => r.Intervals(TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(30)));
                    e.ConfigureConsumer<BlogService.Api.Consumers.UserDeletedConsumer>(context);
                });
            });
        });

        return services;
    }

    public static IServiceCollection AddBlogMediatR(this IServiceCollection services)
    {
        services.AddSingleton<IAuthorizationHandler, OwnerOrAdminHandler>();
        services.AddAutoMapper(cfg => cfg.AddProfile<PostMappingProfile>());
        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(Assembly.Load("BlogService.Application")));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        return services;
    }

    public static IServiceCollection AddBlogAuthentication(this IServiceCollection services, IConfiguration config, string environmentName)
    {
        // === JWT AUTH: IdentityService HS256 token doğrulama ===
        var jwtOptions = BlinkrJwtOptions.FromConfiguration(config, environmentName);

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.RequireHttpsMetadata = false; // dev

                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,

                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,

                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),

                    ValidateLifetime = true,
                    ClockSkew = jwtOptions.ClockSkew,

                    NameClaimType = BlinkrJwtOptions.CanonicalUserIdClaim,
                    RoleClaimType = BlinkrJwtOptions.RoleClaimType,
                    AlgorithmValidator = (algorithm, _, _, _) =>
                        algorithm == SecurityAlgorithms.HmacSha256 ||
                        algorithm == SecurityAlgorithms.HmacSha256Signature
                };

                o.Events = new JwtBearerEvents
                {
                    OnAuthenticationFailed = ctx =>
                    {
                        Serilog.Log.Warning("JWT authentication failed: {ExceptionType}", ctx.Exception.GetType().Name);
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

        services.AddAuthorization(options =>
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

        return services;
    }

    public static IServiceCollection AddBlogHealthChecks(this IServiceCollection services, IConfiguration config)
    {
        // AspNetCore.HealthChecks.RabbitMQ 9.x (RabbitMQ.Client 7.x) no longer accepts a
        // connection string directly - it wants a long-lived IConnection, created once and
        // reused across checks (per the package's own guidance on connection churn).
        var rabbitConnectionString = config.GetConnectionString("RabbitMq") ?? "";
        var rabbitConnectionTask = new Lazy<Task<RabbitMQ.Client.IConnection>>(() =>
        {
            var factory = new RabbitMQ.Client.ConnectionFactory { Uri = new Uri(rabbitConnectionString) };
            return factory.CreateConnectionAsync();
        });

        services.AddHealthChecks()
            .AddCheck("self", () =>
                Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy())
            .AddMongoDb(sp => sp.GetRequiredService<IMongoClient>(), name: "mongo", tags: new[] { "ready" })
            .AddRedis(config.GetConnectionString("Redis") ?? "", name: "redis", tags: new[] { "ready" })
            .AddRabbitMQ(sp => rabbitConnectionTask.Value, name: "rabbitmq", tags: new[] { "ready" })
            .AddCheck<BlogService.Infrastructure.Geocoding.GeocodingHealthCheck>("geocoding", tags: new[] { "ready" });

        return services;
    }

    public static IServiceCollection AddBlogResponseHandling(this IServiceCollection services)
    {
        services.AddResponseCompression(options =>
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

        services.AddResponseCaching();

        services.Configure<GzipCompressionProviderOptions>(options =>
        {
            options.Level = CompressionLevel.Optimal;
        });
        services.Configure<BrotliCompressionProviderOptions>(options =>
        {
            options.Level = CompressionLevel.Optimal;
        });

        return services;
    }

    public static IServiceCollection AddBlogObservability(this IServiceCollection services)
    {
        services.AddOpenTelemetry()
            .ConfigureResource(r => r.AddService("BlogService.Api"))
            .WithTracing(t => t
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddOtlpExporter())
            .WithMetrics(m => m
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddPrometheusExporter());

        return services;
    }
}
