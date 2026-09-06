using IdentityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.TokenHash).IsRequired().HasMaxLength(128);
            entity.HasIndex(t => t.TokenHash).IsUnique();
            entity.HasIndex(t => new { t.UserId, t.ExpiresAtUtc });
            entity.HasOne<User>()
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Seed users
        modelBuilder.Entity<User>().HasData(
           
            new User
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                UserName = "admin",
                Email = "admin@blinkr.com",
                PasswordHash = "$2a$11$hXLp/W1bdJoOpeMemeEDPOABORGf6dxnC6mOg6MtGYsuogWI3Esfu",
                CreatedAt = new DateTime(2025, 10, 9, 10, 55, 12, 941, DateTimeKind.Utc).AddTicks(9578),
                Role = "Admin"
            },
            
            new User
            {
                Id = Guid.Parse("9be75963-a399-4c4d-8c44-cd6817acb801"), 
                UserName = "ahmet",
                Email = "ahmet@blinkr.com",
                PasswordHash = "$2a$11$FN/SP5I8YtI75Mv0c.yr4OczFeKSi5ooBy56u1lopjH5P1CjbkaNS",
                CreatedAt = new DateTime(2025, 10, 9, 10, 55, 13, 90, DateTimeKind.Utc).AddTicks(4912),
                Role = "User"
            }
        );

    
    }
}
