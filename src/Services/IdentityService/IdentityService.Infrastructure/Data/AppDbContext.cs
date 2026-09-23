using IdentityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<UserBlock> UserBlocks => Set<UserBlock>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<Follow> Follows => Set<Follow>();
    public DbSet<SavedPlace> SavedPlaces => Set<SavedPlace>();

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

        modelBuilder.Entity<User>().Property(u => u.AvatarKey).HasMaxLength(IdentityService.Domain.AvatarCatalog.MaxKeyLength);
        modelBuilder.Entity<User>().Property(u => u.Bio).HasMaxLength(FriendshipRules.MaxBioLength);

        modelBuilder.Entity<UserBlock>(entity =>
        {
            entity.HasKey(b => b.Id);
            entity.HasIndex(b => new { b.BlockerId, b.BlockedId }).IsUnique();
            entity.HasIndex(b => b.BlockedId);
            entity.HasOne<User>().WithMany().HasForeignKey(b => b.BlockerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(b => b.BlockedId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Report>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.TargetId).IsRequired().HasMaxLength(SafetyRules.MaxTargetIdLength);
            entity.Property(r => r.Note).HasMaxLength(SafetyRules.MaxNoteLength);
            entity.HasIndex(r => new { r.ReporterId, r.TargetType, r.TargetId }).IsUnique();
            entity.HasIndex(r => new { r.TargetType, r.TargetId });
            entity.HasOne<User>().WithMany().HasForeignKey(r => r.ReporterId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavedPlace>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => new { p.UserId, p.PlaceId }).IsUnique();
            entity.HasIndex(p => new { p.UserId, p.CreatedAtUtc });
            entity.Property(p => p.Name).IsRequired().HasMaxLength(SavedPlaceRules.MaxNameLength);
            entity.Property(p => p.Category).HasMaxLength(SavedPlaceRules.MaxCategoryLength);
            entity.HasOne<User>().WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Follow>(entity =>
        {
            entity.HasKey(f => f.Id);
            entity.HasIndex(f => new { f.FollowerId, f.FolloweeId }).IsUnique();
            entity.HasIndex(f => new { f.FolloweeId, f.Status });
            entity.HasIndex(f => new { f.FollowerId, f.Status });
            entity.HasOne<User>().WithMany().HasForeignKey(f => f.FollowerId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(f => f.FolloweeId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Friendship>(entity =>
        {
            entity.HasKey(f => f.Id);
            entity.HasIndex(f => new { f.UserAId, f.UserBId }).IsUnique();
            entity.HasIndex(f => new { f.AddresseeId, f.Status });
            entity.HasIndex(f => new { f.RequesterId, f.Status });
            entity.HasOne<User>().WithMany().HasForeignKey(f => f.RequesterId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<User>().WithMany().HasForeignKey(f => f.AddresseeId).OnDelete(DeleteBehavior.Cascade);
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
