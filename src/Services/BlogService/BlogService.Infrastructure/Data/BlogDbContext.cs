using BlogService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BlogService.Infrastructure.Data
{
    public class BlogDbContext : DbContext
    {
        public BlogDbContext(DbContextOptions<BlogDbContext> options) : base(options) { }

        public DbSet<Post> Posts { get; set; } = null!;
        public DbSet<PostMedia> PostMedias { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Post Entity Configuration
            modelBuilder.Entity<Post>(entity =>
            {
                entity.HasKey(p => p.Id); // Primary Key
                entity.Property(p => p.Title)
                    .IsRequired()
                    .HasMaxLength(200);

                // Content is optional
                entity.Property(p => p.Content)
                    .HasMaxLength(2000);

                entity.Property(p => p.AuthorId)
                    .IsRequired();

                // Relationship: Post (One) to PostMedia (Many)
                entity.HasMany(p => p.Media)
                    .WithOne(m => m.Post)
                    .HasForeignKey(m => m.PostId)
                    .OnDelete(DeleteBehavior.Cascade); // Cascade Delete
            });

            // PostMedia Entity Configuration
            modelBuilder.Entity<PostMedia>(entity =>
            {
                entity.HasKey(m => m.Id); // Primary Key
                entity.Property(m => m.Url)
                    .IsRequired()
                    .HasMaxLength(500);

                entity.Property(m => m.Type)
                    .IsRequired();
            });
        }
    }
}