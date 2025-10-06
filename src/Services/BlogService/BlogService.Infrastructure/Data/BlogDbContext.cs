using System.Text.Json;
using BlogService.Application.Common.Interfaces;
using BlogService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using BlogService.Domain.Common.Interfaces;
using MediatR; // 👈 Yeni eklendi
using BlogService.Domain.Common; // IHasDomainEvent'i kullanmak için

namespace BlogService.Infrastructure.Data
{
    public class BlogDbContext : DbContext
    {
        private readonly ICurrentUserService _currentUser;
        private readonly IMediator _mediator; // 👈 Yeni eklendi

        public BlogDbContext(
            DbContextOptions<BlogDbContext> options,
            ICurrentUserService currentUser,
            IMediator mediator) : base(options) // 👈 Mediator constructor'a eklendi
        {
            _currentUser = currentUser;
            _mediator = mediator; // 👈 Mediator ataması yapıldı
        }

        public DbSet<Post> Posts => Set<Post>();
        public DbSet<PostMedia> PostMedias => Set<PostMedia>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
        {
            var userId = _currentUser.UserId;
            var now = DateTime.UtcNow;

            // 1. Domain Event'leri yakala (kayıt öncesi)
            // Bu event'ler SaveChangesAsync'ten sonra yayımlanacak.
            var entitiesWithEvents = ChangeTracker.Entries<IHasDomainEvent>()
                .Select(e => e.Entity)
                .Where(e => e.DomainEvents.Any())
                .ToList();

            var pendingAudits = new List<(EntityEntry Entry, AuditLog Audit)>();

            foreach (var entry in ChangeTracker.Entries())
            {
                // AuditLogs’un kendisini audit’leme
                if (entry.Entity is AuditLog)
                    continue;

                // IAuditable meta alanlarını doldur
                if (entry.Entity is IAuditable aud)
                {
                    switch (entry.State)
                    {
                        case EntityState.Added:
                            aud.CreatedAt = now;
                            aud.CreatedBy = userId;
                            break;
                        case EntityState.Modified:
                            aud.LastModifiedAt = now;
                            aud.LastModifiedBy = userId;
                            break;
                    }
                }

                // Sadece Added/Modified/Deleted için audit
                if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
                    continue;

                string? oldValues = null, newValues = null;

                if (entry.State is EntityState.Modified or EntityState.Deleted)
                    oldValues = GetAuditData(entry.OriginalValues);

                if (entry.State is EntityState.Modified or EntityState.Added)
                    newValues = GetAuditData(entry.CurrentValues);

                var entityName = entry.Entity.GetType().Name;
                var entityId = (entry.Entity as BaseEntity)?.Id.ToString() ?? Guid.Empty.ToString();

                var audit = new AuditLog
                {
                    Entity = entityName,
                    Action = entry.State.ToString(),
                    TimestampUtc = now,
                    UserId = userId,
                    EntityId = Guid.Parse(entityId),
                    OldValues = oldValues,
                    NewValues = newValues,
                };

                pendingAudits.Add((entry, audit));
            }

            // 2. Asıl değişiklikleri kaydet (Added ID’leri üretilecek)
            var result = await base.SaveChangesAsync(ct);

            // 3. Audit Loglarını kaydetme (mevcut mantık)
            // Added kayıtlar için gerçek Id’yi audit’e yaz
            foreach (var (entry, audit) in pendingAudits)
            {
                if (audit.Action == EntityState.Added.ToString() && entry.Entity is BaseEntity be)
                {
                    audit.EntityId = be.Id;
                }
            }

            // Audit’leri kaydet
            if (pendingAudits.Count > 0)
            {
                await AuditLogs.AddRangeAsync(pendingAudits.Select(x => x.Audit), ct);
                await base.SaveChangesAsync(ct);
            }

            // 🚨 4. DOMAIN EVENTLERİ YAYIMLA (KRİTİK ADIM)
            await DispatchDomainEventsAsync(entitiesWithEvents);

            return result;
        }

        /// <summary>
        /// Entity'lerden toplanan Domain Event'leri MediatR aracılığıyla yayımlar.
        /// </summary>
        private async Task DispatchDomainEventsAsync(List<IHasDomainEvent> entitiesWithEvents)
        {
            var domainEvents = entitiesWithEvents
                .SelectMany(e => e.DomainEvents)
                .ToList();

            // Olayları Entity'den temizle
            entitiesWithEvents.ForEach(e => e.ClearDomainEvents());

            // Event'leri MediatR'a yayımla
            foreach (var domainEvent in domainEvents)
            {
                // MediatR, IDomainEvent'i INotification olarak görür.
                await _mediator.Publish(domainEvent);
            }
        }


        private static string? GetAuditData(PropertyValues? values)
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
            modelBuilder.Entity<Post>(entity =>
            {
                entity.HasKey(p => p.Id);
                entity.Property(p => p.Title).IsRequired().HasMaxLength(200);
                entity.Property(p => p.Content).HasMaxLength(2000);
                entity.Property(p => p.AuthorId).IsRequired();

                entity.HasMany(p => p.Media)
                        .WithOne(m => m.Post)
                        .HasForeignKey(m => m.PostId)
                        .OnDelete(DeleteBehavior.Cascade);
            });

            // PostMedia
            modelBuilder.Entity<PostMedia>(entity =>
            {
                entity.HasKey(m => m.Id);
                entity.Property(m => m.Url).IsRequired().HasMaxLength(500);
                entity.Property(m => m.Type).IsRequired();
            });

            // AuditLog Configuration
            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.Property(a => a.Entity).IsRequired().HasMaxLength(100);
                entity.Property(a => a.Action).IsRequired().HasMaxLength(20);
                entity.Property(a => a.TimestampUtc).IsRequired();
                entity.Property(a => a.UserId);

                // PostgreSQL için JSONB
                entity.Property(a => a.OldValues).HasColumnType("jsonb");
                entity.Property(a => a.NewValues).HasColumnType("jsonb");

                entity.ToTable("AuditLogs");
            });
        }
    }
}
