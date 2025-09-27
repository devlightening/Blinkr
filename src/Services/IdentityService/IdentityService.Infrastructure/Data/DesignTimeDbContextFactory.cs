using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace IdentityService.Infrastructure.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        // Buraya connection string'i doğrudan yazabilirsin
        // Migration için gerekli. Runtime'da Program.cs'deki kullanılacak.
        optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=blinkr_identity;Username=postgres;Password=postgres123");

        return new AppDbContext(optionsBuilder.Options);
    }
}
