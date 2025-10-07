using BlogService.Application.Common.Interfaces;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Repositories;
using BlogService.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using EventStore.Client;
using Shared.Events.Bus;

namespace BlogService.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<BlogDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("BlogDb")));

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IPostRepository, PostRepository>();
        services.AddScoped<IPostReadRepository, PostReadRepository>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<IEventBus, NoopEventBus>();

        var esConn = config.GetSection("EventStore:ConnectionString").Value;
        if (!string.IsNullOrWhiteSpace(esConn))
        {
            services.AddSingleton(new EventStoreClient(EventStoreClientSettings.Create(esConn)));
            services.AddScoped<IEventStoreRepository, EventStoreDbRepository>();
        }
        else
        {
            services.AddScoped<IEventStoreRepository, SqlEventStoreRepository>();
        }


        return services;
    }
}
