using Microsoft.EntityFrameworkCore;

namespace IdentityServerService.Auth;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> opt) : base(opt) { }
    public DbSet<User> Users => Set<User>();
}

public class User
{
    public Guid Id { get; set; }
    public string UserName { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!; // BCrypt hash
    public DateTime CreatedAt { get; set; }
}
