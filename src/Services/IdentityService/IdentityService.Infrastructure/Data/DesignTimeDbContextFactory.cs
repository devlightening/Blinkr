using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace IdentityService.Infrastructure.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        // Migration sırasında kullanılacak connection string.
        // Runtime'da `Program.cs` içindeki yapılandırma kullanılacaktır.
        optionsBuilder.UseNpgsql("Host=localhost;Port=5432;Database=blinkr_identity;Username=silvanus;Password=Aq.199388200");

        return new AppDbContext(optionsBuilder.Options);
    }
}
