using Blinkr.Projections.Worker.Consumers;
using MassTransit;
using MongoDB.Driver;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using Serilog;
using Serilog.Events;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using HealthChecks.UI.Client;
using MongoDB.Bson;

Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

Log.Information("Starting Blinkr.Projections.Worker service...");

try
{
    // --- IMPORTANT: Register Guid serializer BEFORE any MongoClient is created ---
    BsonSerializer.RegisterSerializer(typeof(Guid), new GuidSerializer(GuidRepresentation.Standard));
    BsonSerializer.RegisterSerializer(typeof(Guid?), new NullableSerializer<Guid>(new GuidSerializer(GuidRepresentation.Standard)));
    Log.Information("Registered Guid serializers for MongoDB (GuidRepresentation.Standard)");

    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    builder.Services.Configure<HostOptions>(opts => opts.ShutdownTimeout = TimeSpan.FromSeconds(45));

    // Mongo connection string
    var cs = builder.Configuration.GetConnectionString("MongoDb");
    if (string.IsNullOrWhiteSpace(cs))
    {
        Log.Warning("MongoDb connection string not found in configuration!");
        cs = "mongodb://localhost:27017/?authSource=BlinkrReadModel";
    }
    Log.Information("Effective MongoDb CS: {Conn}", cs.Replace("blinkr123", "******"));

    builder.Services.AddSingleton<IMongoClient>(_ =>
    {
        var settings = MongoClientSettings.FromConnectionString(cs);
        
        // Connection pooling optimization for Worker
        settings.MaxConnectionPoolSize = 100; // Lower than API since fewer concurrent operations
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
    builder.Services.AddSingleton<IMongoDatabase>(sp =>
    {
        var client = sp.GetRequiredService<IMongoClient>();
        var dbName = builder.Configuration["MongoDbSettings:DatabaseName"] ?? "BlinkrReadModel";
        return client.GetDatabase(dbName);
    });

    // Redis Cache
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = "localhost:6379";
        options.InstanceName = "Blinkr";
    });

    // Health checks
    builder.Services.AddHealthChecks()
        .AddRedis("localhost:6379", name: "redis");

    // Mongo test service
    builder.Services.AddHostedService<PingMongoOnStart>();

    // RabbitMQ configuration
    builder.Services.AddMassTransit(busCfg =>
    {
        busCfg.AddConsumersFromNamespaceContaining<PostCreatedConsumer>();

        busCfg.UsingRabbitMq((ctx, cfg) =>
        {
            var rabbitSection = builder.Configuration.GetSection("RabbitMq");
            var rabbitHost = rabbitSection["Host"] ?? "localhost";
            var rabbitUser = rabbitSection["User"] ?? "user";
            var rabbitPass = rabbitSection["Pass"] ?? "password";

            cfg.Host(rabbitHost, "/", h =>
            {
                h.Username(rabbitUser);
                h.Password(rabbitPass);
            });

            cfg.UseMessageRetry(r => r.Interval(3, TimeSpan.FromSeconds(5)));
            
            // Global concurrency limit for better throughput
            cfg.UseConcurrencyLimit(64);
            
            // EXPLICIT RECEIVE ENDPOINT - guaranteed queue consumption with performance tuning
            cfg.ReceiveEndpoint("post-created", e =>
            {
                e.PrefetchCount = 32; // Optimize consumer throughput
                e.ConfigureConsumer<PostCreatedConsumer>(ctx);
                Log.Information("Configured endpoint post-created, Consumer: {Consumer}", nameof(PostCreatedConsumer));
            });
            
            cfg.ReceiveEndpoint("post-content-updated", e =>
            {
                e.PrefetchCount = 32;
                e.ConfigureConsumer<PostContentUpdatedConsumer>(ctx);
                Log.Information("Configured endpoint post-content-updated, Consumer: {Consumer}", nameof(PostContentUpdatedConsumer));
            });
            
            cfg.ReceiveEndpoint("post-deleted", e =>
            {
                e.PrefetchCount = 32;
                e.ConfigureConsumer<PostDeletedConsumer>(ctx);
                Log.Information("Configured endpoint post-deleted, Consumer: {Consumer}", nameof(PostDeletedConsumer));
            });
            
            cfg.ReceiveEndpoint("post-liked", e =>
            {
                e.PrefetchCount = 32;
                e.ConfigureConsumer<PostLikedConsumer>(ctx);
                Log.Information("Configured endpoint post-liked, Consumer: {Consumer}", nameof(PostLikedConsumer));
            });
            
            cfg.ReceiveEndpoint("post-comment-added", e =>
            {
                e.PrefetchCount = 32;
                e.ConfigureConsumer<PostCommentAddedConsumer>(ctx);
                Log.Information("Configured endpoint post-comment-added, Consumer: {Consumer}", nameof(PostCommentAddedConsumer));
            });

            Log.Information("RabbitMQ configured with host: {Host}", rabbitHost);
        });
    });

    var app = builder.Build();

    // Health check endpoint
    app.MapHealthChecks("/health", new HealthCheckOptions
    {
        ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
    });

    Log.Information("🚀 Worker is now running. Press Ctrl+C to shut down.");
    
    await app.RunAsync();
    
    Log.Information("🛑 Worker shutting down...");
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Worker failed to start.");
    return 1;
}
finally
{
    Log.CloseAndFlush();
}
