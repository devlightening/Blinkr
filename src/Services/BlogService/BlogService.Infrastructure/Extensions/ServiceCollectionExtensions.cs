using BlogService.Application.Common.Interfaces;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Repositories;
using BlogService.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BlogService.Infrastructure.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<BlogDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("BlogDb")));

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IPostRepository, PostRepository>();

        return services;
    }
}
