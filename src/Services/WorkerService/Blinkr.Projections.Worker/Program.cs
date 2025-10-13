using Blinkr.Projections.Worker.Consumers;
using MassTransit;
using MongoDB.Driver;
using Serilog;
using Serilog.Events;
using Microsoft.Extensions.Hosting;

Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

Log.Information("Starting Blinkr.Projections.Worker service...");

Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Development");

try
{
    var host = Host.CreateDefaultBuilder(args)
        .UseSerilog()
        .ConfigureServices((context, services) =>
        {
            var env = context.HostingEnvironment.EnvironmentName;
            Log.Information("Environment: {Env}", env);

            // Mongo baglanti dizesini oku
            var cs = context.Configuration.GetConnectionString("MongoDb");
            if (string.IsNullOrWhiteSpace(cs))
            {
                Log.Warning("MongoDb connection string not found in configuration!");
                cs = "mongodb://localhost:27017/?authSource=BlinkrReadModel";
            }

            Log.Information("Effective MongoDb CS: {Conn}", cs.Replace("blinkr123", "******"));

            // Mongo Client ve Database with STRICT Write Concern
            services.AddSingleton<IMongoClient>(_ =>
            {
                var settings = MongoClientSettings.FromConnectionString(cs);
                // CRITICAL: Force synchronous, journaled writes for standalone MongoDB
                settings.WriteConcern = new WriteConcern(w: 1, journal: true);
                settings.ReadConcern = ReadConcern.Local;
                Log.Information("📝 MongoDB WriteConcern set to W=1, Journal=true for data durability");
                return new MongoClient(settings);
            });
            services.AddSingleton<IMongoDatabase>(sp =>
            {
                var client = sp.GetRequiredService<IMongoClient>();
                var dbName = context.Configuration["MongoDbSettings:DatabaseName"] ?? "BlinkrReadModel";
                return client.GetDatabase(dbName);
            });

            // Mongo test servisi
            services.AddHostedService<PingMongoOnStart>();

            // RabbitMQ yapılandırması - FIXED
            services.AddMassTransit(busCfg =>
            {
                // Tüm consumer'ları ekle
                busCfg.AddConsumersFromNamespaceContaining<PostCreatedConsumer>();
                
                busCfg.UsingRabbitMq((ctx, cfg) =>
                {
                    var rabbitSection = context.Configuration.GetSection("RabbitMq");
                    var rabbitHost = rabbitSection["Host"] ?? "localhost";
                    var rabbitUser = rabbitSection["User"] ?? "user";
                    var rabbitPass = rabbitSection["Pass"] ?? "password";

                    cfg.Host(rabbitHost, "/", h =>
                    {
                        h.Username(rabbitUser);
                        h.Password(rabbitPass);
                    });

                    // CRITICAL FIX: Prefix olmadan, sadece KebabCase kullan
                    // Bu "blinkr-post-created" gibi queue isimleri oluşturur
                    cfg.ConfigureEndpoints(ctx, new KebabCaseEndpointNameFormatter(false));
                    
                    Log.Information("RabbitMQ configured with host: {Host}", rabbitHost);
                });
            });
        })
        .Build();

    await host.RunAsync();
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
