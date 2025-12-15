using Blinkr.Projections.Worker.Extensions;
using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Events;

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
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();
    builder.Services.Configure<HostOptions>(opts => opts.ShutdownTimeout = TimeSpan.FromSeconds(45));

    builder.Services
        .AddWorkerMongoDB(builder.Configuration)
        .AddWorkerRedisCache()
        .AddWorkerMessaging(builder.Configuration)
        .AddHostedService<PingMongoOnStart>();

    var app = builder.Build();

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
