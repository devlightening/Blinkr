using BlogService.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BlogService.Infrastructure.Data
{
    public class BlogDbContext : DbContext
    {
        public BlogDbContext(DbContextOptions<BlogDbContext> options) : base(options) { }

        public DbSet<Post> Posts { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Config
            modelBuilder.Entity<Post>(entity =>
            {
                entity.HasKey(p => p.Id);
                entity.Property(p => p.Title).IsRequired().HasMaxLength(200);
                entity.Property(p => p.Content).IsRequired();
                entity.Property(p => p.AuthorId).IsRequired();
            });
        }
    }
}
