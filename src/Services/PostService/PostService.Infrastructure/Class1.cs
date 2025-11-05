using Microsoft.EntityFrameworkCore;
using PostService.Domain.Entities;
using NetTopologySuite.Geometries;

namespace PostService.Infrastructure.Data;

public class PostServiceDbContext : DbContext
{
    public PostServiceDbContext(DbContextOptions<PostServiceDbContext> options) 
        : base(options)
    {
    }

    public DbSet<Post> Posts => Set<Post>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Post>(entity =>
        {
            entity.ToTable("Posts");
            entity.HasKey(p => p.Id);

            entity.Property(p => p.Title)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(p => p.Content)
                .HasMaxLength(5000);

            entity.Property(p => p.MediaUrl)
                .HasMaxLength(500);

            entity.Property(p => p.Visibility)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue("Public");

            // PostGIS configuration
            entity.Property(p => p.Location)
                .HasColumnType("geography(Point, 4326)"); // WGS84

            // Spatial index for performance
            entity.HasIndex(p => p.Location)
                .HasMethod("GIST");

            // Index for userId queries
            entity.HasIndex(p => p.UserId);

            // Index for created date
            entity.HasIndex(p => p.CreatedAt);
        });
    }
}
