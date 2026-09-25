using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using MassTransit;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using System.Text;
using System.Text.Json.Serialization;
using NotificationsService.Application.Queries;
using NotificationsService.Domain.Interfaces;
using NotificationsService.Infrastructure.Repositories;
using NotificationsService.Infrastructure.Config;
using NotificationsService.Infrastructure.Messaging;
using NotificationsService.Infrastructure.Push;
using Shared.Auth;

namespace NotificationsService.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddNotificationsControllers(this IServiceCollection services)
    {
        services.AddControllers()
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        services.AddScoped<NotificationsService.Api.Filters.ChatExceptionFilter>();
        services.AddScoped<NotificationsService.Api.Realtime.RealtimeChatFilter>();

        services.AddEndpointsApiExplorer();
        return services;
    }

    /// <summary>The identity service owns blocks; chat asks it before a conversation, message or snap goes out.</summary>
    public static IServiceCollection AddNotificationsBlockGuard(this IServiceCollection services, IConfiguration configuration)
    {
        var baseUrl = configuration["Services:IdentityBaseUrl"] ?? "http://localhost:5188";
        services.AddHttpContextAccessor();
        services.AddHttpClient(NotificationsService.Api.Services.IdentityBlockGuard.ClientName, client =>
        {
            client.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(3);
        });
        services.AddScoped<IBlockGuard, NotificationsService.Api.Services.IdentityBlockGuard>();
        // S3: sending chat messages and snaps is limited per person (RateLimits:ChatPerMinute, 60 by default).
        var chatPerMinute = Math.Clamp(configuration.GetValue("RateLimits:ChatPerMinute", 60), 1, 100_000);
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsJsonAsync(new { code = "TOO_MANY_MESSAGES", message = "Çok hızlı mesaj gönderiyorsun. Biraz yavaşla." }, ct);
            };
            options.AddPolicy("chat-send", http => System.Threading.RateLimiting.RateLimitPartition.GetSlidingWindowLimiter(
                http.User.FindFirst("sub")?.Value ?? http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new System.Threading.RateLimiting.SlidingWindowRateLimiterOptions { PermitLimit = chatPerMinute, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0 }));
        });
        // V2-5 (D-028): the realtime hub; joining a signal's room asks BlogService whether the caller may read it.
        services.AddSignalR();
        services.AddSingleton<NotificationsService.Domain.Interfaces.IRealtimePublisher, NotificationsService.Api.Realtime.SignalRRealtimePublisher>();
        services.AddHttpClient(NotificationsService.Api.Realtime.RealtimeHub.BlogClientName, client =>
        {
            client.BaseAddress = new Uri((configuration["Services:BlogBaseUrl"] ?? "http://localhost:5215").TrimEnd('/') + "/");
            client.Timeout = TimeSpan.FromSeconds(3);
        });
        services.AddSingleton<NotificationsService.Application.Handlers.TypingTracker>();
        return services;
    }

    public static IServiceCollection AddNotificationsMediatR(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(GetUnreadCountQuery).Assembly);
        });

        return services;
    }

    public static IServiceCollection AddNotificationsRepositories(this IServiceCollection services)
    {
        // V2-5 (D-028): every stored notification is also pushed to its owner over the realtime hub.
        services.AddScoped<MongoNotificationRepository>();
        services.AddScoped<INotificationRepository>(sp => new NotificationsService.Api.Realtime.RealtimeNotificationRepository(
            sp.GetRequiredService<MongoNotificationRepository>(), sp.GetRequiredService<NotificationsService.Domain.Interfaces.IRealtimePublisher>()));
        services.AddScoped<IDeviceTokenRepository, MongoDeviceTokenRepository>();
        services.AddScoped<IConversationRepository, MongoConversationRepository>();
        services.AddScoped<IChatMessageRepository, MongoChatMessageRepository>();

        return services;
    }

    /// <summary>Snaps: limits from the "Snaps" section, private disk storage and the cleanup job.</summary>
    public static IServiceCollection AddNotificationsSnaps(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        var settings = configuration.GetSection("Snaps").Get<NotificationsService.Application.Snaps.SnapSettings>() ?? new NotificationsService.Application.Snaps.SnapSettings();
        services.AddSingleton(settings);
        services.AddSingleton<ISnapStorage>(new NotificationsService.Infrastructure.Storage.LocalSnapStorage(settings.StorageRoot, environment.ContentRootPath));
        services.AddHostedService<NotificationsService.Api.Services.SnapCleanupService>();
        // Stories (Faz 7) share the private snap storage; visibility comes from the identity service follow graph.
        services.AddHttpContextAccessor();
        services.AddScoped<NotificationsService.Api.Stories.FollowGraphClient>();
        services.AddHostedService<NotificationsService.Api.Stories.StoryCleanupService>();

        return services;
    }

    public static IServiceCollection AddNotificationsMessaging(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RabbitOptions>(configuration.GetSection("RabbitMQ"));

        services.AddMassTransit(busCfg =>
        {
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.EventConsumer.PostLikedNotificationConsumer>();
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.EventConsumer.PostCommentAddedNotificationConsumer>();
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.UserFollowedNotificationConsumer>();
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.FollowAcceptedNotificationConsumer>();
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.ModerationNotificationConsumer>();
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.PostMentionNotificationConsumer>();
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.PostRealtimeConsumer>();
            busCfg.AddConsumer<NotificationsService.Api.Consumers.UserDeletedConsumer>();

            busCfg.UsingRabbitMq((ctx, cfg) =>
            {
                var rabbit = configuration.GetSection("RabbitMQ");

                var host = rabbit["HostName"] ?? "localhost";
                var user = rabbit["UserName"] ?? "guest";
                var pass = rabbit["Password"] ?? "guest";
                var portStr = rabbit["Port"];
                ushort port = 0;
                ushort.TryParse(portStr, out port);

                var logger = ctx.GetRequiredService<ILogger<Program>>();
                logger.LogInformation("Configuring RabbitMQ host={Host} port={Port} user={User}", host, port, user);

                if (port > 0)
                {
                    cfg.Host(host, port, "/", h =>
                    {
                        h.Username(user);
                        h.Password(pass);
                    });
                }
                else
                {
                    cfg.Host(host, "/", h =>
                    {
                        h.Username(user);
                        h.Password(pass);
                    });
                }

                cfg.ConfigureEndpoints(ctx);
            });
        });

        services.AddScoped<IPushSender>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<NoopSender>>();
            return new NoopSender(logger);
        });

        services.AddHostedService<EventConsumer>();

        return services;
    }

    public static IServiceCollection AddNotificationsAuthentication(this IServiceCollection services, IConfiguration configuration, string environmentName)
    {
        var jwtOptions = BlinkrJwtOptions.FromConfiguration(configuration, environmentName);

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.TokenValidationParameters = new TokenValidationParameters
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

                options.Events = new JwtBearerEvents
                {
                    // A refresh token is not an access token (BLK-TOKENS-01).
                    OnTokenValidated = ctx =>
                    {
                        if (!Shared.Auth.BlinkrJwtOptions.IsAccessToken(ctx.Principal)) ctx.Fail("Refresh tokens cannot be used as access tokens.");
                        return Task.CompletedTask;
                    },
                    // V2-5: WebSockets cannot carry an Authorization header from a browser or React Native, so the hub
                    // (and only the hub) reads the token from ?access_token=.
                    OnMessageReceived = ctx =>
                    {
                        var token = ctx.Request.Query["access_token"].ToString();
                        if (!string.IsNullOrEmpty(token) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs")) ctx.Token = token;
                        return Task.CompletedTask;
                    },
                    OnAuthenticationFailed = ctx =>
                    {
                        var logger = ctx.HttpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger("JwtBearer");
                        logger?.LogWarning("JWT authentication failed: {ExceptionType}", ctx.Exception.GetType().Name);
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

        services.AddAuthorization();

        return services;
    }

    public static IServiceCollection AddNotificationsSwagger(this IServiceCollection services)
    {
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new() { Title = "Notifications API", Version = "v1" });
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

    public static IServiceCollection AddNotificationsMongoDB(this IServiceCollection services, IConfiguration configuration)
    {
        BsonSerializer.RegisterSerializer(new MongoDB.Bson.Serialization.Serializers.GuidSerializer(MongoDB.Bson.GuidRepresentation.Standard));

        services.AddSingleton<IMongoClient>(sp =>
        {
            var connectionString = configuration.GetSection("Mongo")["ConnectionString"];
            return new MongoClient(connectionString);
        });

        services.AddSingleton<IMongoDatabase>(sp =>
        {
            var client = sp.GetRequiredService<IMongoClient>();
            var databaseName = configuration.GetSection("Mongo")["Database"];
            return client.GetDatabase(databaseName);
        });

        return services;
    }

    public static IServiceCollection AddNotificationsHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy())
            .AddMongoDb(sp => sp.GetRequiredService<IMongoClient>(), name: "mongodb", tags: new[] { "ready" });

        return services;
    }
}
