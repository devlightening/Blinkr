using IdentityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace IdentityService.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

  

        // Seed users
        modelBuilder.Entity<User>().HasData(
           
            new User
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                UserName = "admin",
                Email = "admin@blinkr.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                Role = "Admin"
            },
            
            new User
            {
                Id = Guid.Parse("9be75963-a399-4c4d-8c44-cd6817acb801"), 
                UserName = "ahmet",
                Email = "ahmet@blinkr.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("User123!"), 
                Role = "User"
            }
        );

    
    }
}
