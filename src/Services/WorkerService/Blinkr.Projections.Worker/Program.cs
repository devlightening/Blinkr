using Blinkr.Projections.Worker.Consumers;
using MassTransit;
using MongoDB.Driver;
using Serilog;
using Serilog.Events;
using Microsoft.Extensions.Hosting; // HostOptions için

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

Log.Information("Starting Blinkr.Projections.Worker service...");

try
{
    var host = Host.CreateDefaultBuilder(args)
        .UseSerilog()
        .ConfigureServices((context, services) =>
        {
            // Worker bir BackgroundService içinde exception atarsa host’u kapatma (debug için)
            services.Configure<HostOptions>(o =>
                o.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore);

            var cs = context.Configuration.GetConnectionString("MongoDb") ?? "(null)";
            Log.Information("Effective MongoDb CS: {Conn}", cs.Replace("blinkr123", "******"));

            services.AddSingleton<IMongoClient>(sp =>
            {
                var cs = context.Configuration.GetConnectionString("MongoDb")
                         ?? "mongodb://blinkr_re:blinkr123@127.0.0.1:27017/?authSource=BlinkrReadModel&authMechanism=SCRAM-SHA-256";

                return new MongoClient(cs);
            });


            services.AddSingleton<IMongoDatabase>(sp =>
            {
                var client = sp.GetRequiredService<IMongoClient>();
                var dbName = context.Configuration["MongoDbSettings:DatabaseName"] ?? "BlinkrReadModel";
                return client.GetDatabase(dbName);
            });

            // Baþlangýçta PING at, ama hata olsa bile uygulamayý düþürme
            services.AddHostedService<PingMongoOnStart>();

            services.AddMassTransit(busCfg =>
            {
                busCfg.AddConsumersFromNamespaceContaining<PostCreatedConsumer>();
                busCfg.UsingRabbitMq((ctx, cfg) =>
                {
                    var rabbitHost = context.Configuration.GetSection("RabbitMq")["Host"] ?? "localhost";
                    cfg.Host(rabbitHost, "/", h =>
                    {
                        h.Username("user");
                        h.Password("password");
                    });
                    cfg.ConfigureEndpoints(ctx, new KebabCaseEndpointNameFormatter("Blinkr", false));
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
finally { Log.CloseAndFlush(); }
