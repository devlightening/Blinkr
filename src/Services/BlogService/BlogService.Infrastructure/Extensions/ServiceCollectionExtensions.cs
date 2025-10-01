using BlogService.Application.Common.Interfaces;
using BlogService.Infrastructure.Repositories;
using BlogService.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

namespace BlogService.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IPostRepository, PostRepository>();
        return services;
    }
}
