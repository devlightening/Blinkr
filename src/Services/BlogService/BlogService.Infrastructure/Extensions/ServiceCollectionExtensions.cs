using BlogService.Application.Common.Interfaces;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Repositories;
using BlogService.Infrastructure.Services;
using EventStore.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BlogService.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration config)
    {
        // 1. PostgreSQL DbContext'leri
        // Outbox ve (şimdilik) Read Model için kullanılırlar.
        services.AddDbContext<BlogDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("BlogDb")));

        services.AddDbContext<OutboxDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("BlogDb"), pgOpt =>
                pgOpt.MigrationsAssembly(typeof(OutboxDbContext).Assembly.FullName)));

        // 2. EventStoreDB İstemcisi
        var esConn = config.GetConnectionString("EventStore");
        if (string.IsNullOrEmpty(esConn))
        {
            throw new InvalidOperationException("EventStore connection string ('ConnectionStrings:EventStore') is not configured in appsettings.");
        }
        services.AddSingleton(new EventStoreClient(EventStoreClientSettings.Create(esConn)));

        // 3. Repository Kayıtları (Nihai Mimarimize Göre)
        services.AddScoped<IEventStoreRepository, EventStoreDbRepository>(); // Write Model için
        services.AddScoped<IPostReadRepository, PostReadRepository>();     // Read Model için

        // 4. Diğer Altyapı Servisleri
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        return services;
    }
}
