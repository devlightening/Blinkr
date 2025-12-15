using Blinkr.Projections.Worker.Consumers;
using MassTransit;
using MongoDB.Driver;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using Serilog;
using Microsoft.Extensions.Caching.StackExchangeRedis;

namespace Blinkr.Projections.Worker.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWorkerMongoDB(this IServiceCollection services, IConfiguration config)
    {
        BsonSerializer.RegisterSerializer(typeof(Guid), new GuidSerializer(GuidRepresentation.Standard));
        BsonSerializer.RegisterSerializer(typeof(Guid?), new NullableSerializer<Guid>(new GuidSerializer(GuidRepresentation.Standard)));
        Log.Information("Registered Guid serializers for MongoDB (GuidRepresentation.Standard)");

        var cs = config.GetConnectionString("MongoDb");
        if (string.IsNullOrWhiteSpace(cs))
        {
            Log.Warning("MongoDb connection string not found in configuration!");
            cs = "mongodb://localhost:27017/?authSource=BlinkrReadModel";
        }
        Log.Information("Effective MongoDb CS: {Conn}", cs.Replace("blinkr123", "******"));

        services.AddSingleton<IMongoClient>(_ =>
        {
            var settings = MongoClientSettings.FromConnectionString(cs);
            settings.MaxConnectionPoolSize = 100;
            settings.MinConnectionPoolSize = 5;
            settings.ConnectTimeout = TimeSpan.FromSeconds(10);
            settings.WaitQueueTimeout = TimeSpan.FromSeconds(5);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
            settings.WriteConcern = new WriteConcern(w: 1, journal: true);
            settings.ReadConcern = ReadConcern.Local;
            Log.Information("📝 MongoDB WriteConcern set to W=1, Journal=true for data durability");
            Log.Information("📝 MongoDB connection pool: Max={Max}, Min={Min}", settings.MaxConnectionPoolSize, settings.MinConnectionPoolSize);
            return new MongoClient(settings);
        });

        services.AddSingleton<IMongoDatabase>(sp =>
        {
            var client = sp.GetRequiredService<IMongoClient>();
            var dbName = config["MongoDbSettings:DatabaseName"] ?? "BlinkrReadModel";
            return client.GetDatabase(dbName);
        });

        return services;
    }

    public static IServiceCollection AddWorkerRedisCache(this IServiceCollection services)
    {
        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = "localhost:6379";
            options.InstanceName = "Blinkr";
        });

        services.AddHealthChecks()
            .AddRedis("localhost:6379", name: "redis");

        return services;
    }

    public static IServiceCollection AddWorkerMessaging(this IServiceCollection services, IConfiguration config)
    {
        services.AddMassTransit(busCfg =>
        {
            busCfg.AddConsumersFromNamespaceContaining<PostCreatedConsumer>();

            busCfg.UsingRabbitMq((ctx, cfg) =>
            {
                var rabbitSection = config.GetSection("RabbitMq");
                var rabbitHost = rabbitSection["Host"] ?? "localhost";
                var rabbitUser = rabbitSection["User"] ?? "user";
                var rabbitPass = rabbitSection["Pass"] ?? "password";

                cfg.Host(rabbitHost, "/", h =>
                {
                    h.Username(rabbitUser);
                    h.Password(rabbitPass);
                });

                cfg.UseMessageRetry(r => r.Interval(3, TimeSpan.FromSeconds(5)));
                cfg.UseConcurrencyLimit(64);

                ConfigureReceiveEndpoints(cfg, ctx);

                Log.Information("RabbitMQ configured with host: {Host}", rabbitHost);
            });
        });

        return services;
    }

    private static void ConfigureReceiveEndpoints(IRabbitMqBusFactoryConfigurator cfg, IBusRegistrationContext ctx)
    {
        cfg.ReceiveEndpoint("post-created", e =>
        {
            e.PrefetchCount = 32;
            e.ConfigureConsumer<PostCreatedConsumer>(ctx);
            Log.Information("✅ Configured endpoint post-created for PostCreatedConsumer");
        });

        cfg.ReceiveEndpoint("post-content-updated", e =>
        {
            e.PrefetchCount = 32;
            e.ConfigureConsumer<PostContentUpdatedConsumer>(ctx);
            Log.Information("✅ Configured endpoint post-content-updated for PostContentUpdatedConsumer");
        });

        cfg.ReceiveEndpoint("post-deleted", e =>
        {
            e.PrefetchCount = 32;
            e.ConfigureConsumer<PostDeletedConsumer>(ctx);
            Log.Information("✅ Configured endpoint post-deleted for PostDeletedConsumer");
        });

        cfg.ReceiveEndpoint("post-liked", e =>
        {
            e.PrefetchCount = 32;
            e.ConfigureConsumer<PostLikedConsumer>(ctx);
            Log.Information("✅ Configured endpoint post-liked for PostLikedConsumer");
        });

        cfg.ReceiveEndpoint("post-unliked", e =>
        {
            e.PrefetchCount = 32;
            e.ConfigureConsumer<PostUnlikedConsumer>(ctx);
            Log.Information("✅ Configured endpoint post-unliked for PostUnlikedConsumer");
        });

        cfg.ReceiveEndpoint("post-comment-added", e =>
        {
            e.PrefetchCount = 32;
            e.ConfigureConsumer<PostCommentAddedConsumer>(ctx);
            Log.Information("✅ Configured endpoint post-comment-added for PostCommentAddedConsumer");
        });
    }
}
