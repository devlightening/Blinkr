
using NotificationsService.Domain.Interfaces;
using NotificationsService.Infrastructure.Config;
using NotificationsService.Infrastructure.Messaging;
using NotificationsService.Infrastructure.Push;
using NotificationsService.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace NotificationsService.Infrastructure.DI;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddNotificationsInfrastructure(this IServiceCollection services, IConfiguration cfg)
    {
        services.Configure<MongoOptions>(cfg.GetSection("Mongo"));
        services.Configure<RabbitOptions>(cfg.GetSection("RabbitMQ"));
        services.Configure<FcmOptions>(cfg.GetSection("Fcm"));
        
        services.AddSingleton<IMongoDatabase>(sp =>
        {
            var opt = sp.GetRequiredService<IOptions<MongoOptions>>().Value;

            var settings = MongoClientSettings.FromConnectionString(opt.ConnectionString);
            // GuidRepresentation property was removed in newer MongoDB.Driver versions.
            // We configure Guid handling via Bson attributes on entities.

            var client = new MongoClient(settings);
            return client.GetDatabase(opt.Database);
        });

     

        services.AddScoped<INotificationRepository, MongoNotificationRepository>();
        services.AddScoped<IDeviceTokenRepository, MongoNotificationRepository>();

        services.AddScoped<IPushSender>(sp =>
        {
            var o = sp.GetRequiredService<IOptions<FcmOptions>>().Value;
            return string.IsNullOrWhiteSpace(o.CredentialsPath)
                ? new NoopSender(sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<NoopSender>>())
                : new FcmSender(sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<FcmSender>>(),
                                sp.GetRequiredService<IOptions<FcmOptions>>());
        });

        services.AddHostedService<EventConsumer>();
        return services;
    }
}