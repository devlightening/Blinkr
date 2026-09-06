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

        services.AddEndpointsApiExplorer();
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
        services.AddScoped<INotificationRepository, MongoNotificationRepository>();
        services.AddScoped<IDeviceTokenRepository, MongoDeviceTokenRepository>();

        return services;
    }

    public static IServiceCollection AddNotificationsMessaging(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RabbitOptions>(configuration.GetSection("RabbitMQ"));

        services.AddMassTransit(busCfg =>
        {
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.EventConsumer.PostLikedNotificationConsumer>();
            busCfg.AddConsumer<NotificationsService.Infrastructure.Messaging.EventConsumer.PostCommentAddedNotificationConsumer>();

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
