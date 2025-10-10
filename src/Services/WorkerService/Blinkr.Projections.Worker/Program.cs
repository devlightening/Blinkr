using Blinkr.Projections.Worker.Consumers;
using MassTransit;
using MongoDB.Driver;
using Serilog;
using GenericHost = Microsoft.Extensions.Hosting.Host;

// DÜZELTME: Serilog yapýlandýrmasýný en baþa alarak
// uygulama çökerse bile loglarý görebilmemizi saðlýyoruz.
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

Log.Information("Starting Blinkr.Projections.Worker service...");

try
{
    var host = GenericHost.CreateDefaultBuilder(args)
        .UseSerilog((context, config) =>
        {
            // appsettings.json'daki Serilog ayarlarýný oku
            config.ReadFrom.Configuration(context.Configuration);
        })
        .ConfigureServices((context, services) =>
        {
            // MongoDB Ýstemcisini ve Veritabanýný Ayarla
            services.AddSingleton<IMongoClient>(sp =>
                new MongoClient(context.Configuration.GetConnectionString("MongoDb")));

            services.AddSingleton<IMongoDatabase>(sp =>
            {
                var client = sp.GetRequiredService<IMongoClient>();
                var dbName = context.Configuration["MongoDbSettings:DatabaseName"];
                return client.GetDatabase(dbName);
            });

            // MassTransit ve RabbitMQ'yu Ayarla
            services.AddMassTransit(busConfig =>
            {
                busConfig.AddConsumersFromNamespaceContaining<PostCreatedConsumer>();

                busConfig.UsingRabbitMq((busContext, cfg) =>
                {
                    var rabbitMqConfig = context.Configuration.GetSection("RabbitMq");
                    cfg.Host(rabbitMqConfig["Host"], "/", h => {
                        h.Username("user");
                        h.Password("password");
                    });

                    cfg.ConfigureEndpoints(busContext);
                });
            });
        })
        .Build();

    await host.RunAsync();

    return 0; // Baþarýlý çýkýþ
}
catch (Exception ex)
{
    Log.Fatal(ex, "An unexpected error occurred while starting the Blinkr.Projections.Worker service.");
    return 1; // Hatalý çýkýþ
}
finally
{
    Log.CloseAndFlush();
}

