using BlogService.Application.Interfaces;
using BlogService.Infrastructure.Data;
using BlogService.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BlogService.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
        {
            // PostgreSQL DbContext
            services.AddDbContext<BlogDbContext>(options =>
                options.UseNpgsql(config.GetConnectionString("DefaultConnection")));

            // Services
            services.AddScoped<IPostService, PostService>();

            return services;
        }
    }
}
