using System.Text.Json;
using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Common.Interfaces;
using BlogService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace BlogService.Infrastructure.Data
{
    public class BlogDbContext : DbContext
    {
        private readonly ICurrentUserService _currentUser;

        public BlogDbContext(
            DbContextOptions<BlogDbContext> options,
            ICurrentUserService currentUser) : base(options)
        {
            _currentUser = currentUser;
        }

        public DbSet<Post> Posts => Set<Post>();
        public DbSet<PostMedia> PostMedias => Set<PostMedia>();

        // DÜZELTİLDİ: Kalıcı tablo bu
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var now = DateTime.UtcNow;

            var pending = new List<(EntityEntry Entry, AuditLog Log)>();

            foreach (var entry in ChangeTracker.Entries())
            {
                // AuditLog’un kendisini audit’leme
                if (entry.Entity is AuditLog) continue;

                // auditable alanlar
                if (entry.Entity is IAuditable aud)
                {
                    if (entry.State == EntityState.Added)
                    {
                        aud.CreatedAt = now;
                        aud.CreatedBy = userId;
                    }
                    else if (entry.State == EntityState.Modified)
                    {
                        aud.LastModifiedAt = now;
                        aud.LastModifiedBy = userId;
                    }
                }

                if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
                    continue;

                string? oldValues = null, newValues = null;

                if (entry.State is EntityState.Modified or EntityState.Deleted)
                    oldValues = Snap(entry.OriginalValues);

                if (entry.State is EntityState.Modified or EntityState.Added)
                    newValues = Snap(entry.CurrentValues);

                var entityName = entry.Entity.GetType().Name;
                var id = (entry.Entity as BaseEntity)?.Id ?? Guid.Empty;

                var log = new AuditLog
                {
                    TimestampUtc = now,
                    UserId = userId,
                    Action = entry.State.ToString(),
                    Entity = entityName,
                    EntityId = id,
                    OldValues = oldValues,
                    NewValues = newValues
                };

                pending.Add((entry, log));
            }

            // önce asıl değişiklikler
            var result = await base.SaveChangesAsync(ct);

            // Added kayıtlar için gerçek Id yaz
            foreach (var (entry, log) in pending)
            {
                if (log.Action == EntityState.Added.ToString() && entry.Entity is BaseEntity be)
                {
                    log.EntityId = be.Id;
                }
            }

            if (pending.Count > 0)
            {
                await AuditLogs.AddRangeAsync(pending.Select(x => x.Log), ct);
                await base.SaveChangesAsync(ct);
            }

            return result;
        }

        private static string? Snap(PropertyValues? values)
        {
            if (values is null) return null;

            var dict = values.Properties
                .Where(p => !p.IsShadowProperty())
                .ToDictionary(p => p.Name, p => values[p]);

            return JsonSerializer.Serialize(dict);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Post
            modelBuilder.Entity<Post>(e =>
            {
                e.HasKey(p => p.Id);
                e.Property(p => p.Title).IsRequired().HasMaxLength(200);
                e.Property(p => p.Content).HasMaxLength(2000);
                e.Property(p => p.AuthorId).IsRequired();

                e.HasMany(p => p.Media)
                 .WithOne(m => m.Post)
                 .HasForeignKey(m => m.PostId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            // PostMedia
            modelBuilder.Entity<PostMedia>(e =>
            {
                e.HasKey(m => m.Id);
                e.Property(m => m.Url).IsRequired().HasMaxLength(500);
                e.Property(m => m.Type).IsRequired();
            });

            // AuditLog
            modelBuilder.Entity<AuditLog>(e =>
            {
                e.HasKey(a => a.Id);
                e.Property(a => a.TimestampUtc).IsRequired();

                e.Property(a => a.Entity).IsRequired().HasMaxLength(100);
                e.Property(a => a.Action).IsRequired().HasMaxLength(20);

                // PostgreSQL kullanıyorsan:
                e.Property(a => a.OldValues).HasColumnType("jsonb");
                e.Property(a => a.NewValues).HasColumnType("jsonb");

                e.ToTable("AuditLogs");
            });
        }
    }
}
