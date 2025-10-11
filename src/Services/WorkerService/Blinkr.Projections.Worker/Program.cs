using Blinkr.Projections.Worker.Consumers;
using MassTransit;
using MongoDB.Driver;
using Serilog;
using Serilog.Events;

// Serilog'u, appsettings'e güvenmeden, doðrudan ve en temiz formatta çalýþacak þekilde ayarlýyoruz.
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(
        outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

Log.Information("Starting Blinkr.Projections.Worker service...");


try
{
    var host = Host.CreateDefaultBuilder(args)
        .UseSerilog()
        .ConfigureServices((context, services) =>
        {
            services.AddSingleton<IMongoClient>(sp =>
                new MongoClient(context.Configuration.GetConnectionString("MongoDb")));

            services.AddSingleton<IMongoDatabase>(sp =>
            {
                var client = sp.GetRequiredService<IMongoClient>();
                var dbName = context.Configuration["MongoDbSettings:DatabaseName"];
                return client.GetDatabase(dbName);
            });

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
                    cfg.ConfigureEndpoints(busContext, new KebabCaseEndpointNameFormatter("Blinkr", false));
                });
            });
        })
        .Build();

    await host.RunAsync();
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "An unexpected error occurred while starting the Blinkr.Projections.Worker service.");
    return 1;
}
finally
{
    Log.CloseAndFlush();
}