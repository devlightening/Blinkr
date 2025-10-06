using IdentityService.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Data
{
    public static class IdentitySeeder
    {
        // Not: Bu ID'ler, AppDbContext HasData'da kullanılan sabit ID'lerle eşleşmelidir.
        public const string AdminId = "11111111-1111-1111-1111-111111111111";
        public const string UserId = "22222222-2222-2222-2222-222222222222";

        public static async Task SeedAsync(AppDbContext _context)
        {
            // Veritabanının oluşturulduğundan emin olun (Gerekli değilse kaldırılabilir)
            // await _context.Database.EnsureCreatedAsync();

            // 1. ADMIN kullanıcısını kontrol et ve ekle
            var adminGuid = Guid.Parse(AdminId);
            var adminExists = await _context.Users.AnyAsync(u => u.Id == adminGuid);

            if (!adminExists)
            {
                var admin = new User
                {
                    Id = adminGuid,
                    UserName = "adminlocal",
                    Email = "adminlocal@blinkr.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                    Role = "Admin",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Users.Add(admin);
            }

            // 2. AHMET kullanıcısını kontrol et ve ekle
            var userGuid = Guid.Parse(UserId);
            var userExists = await _context.Users.AnyAsync(u => u.Id == userGuid);

            if (!userExists)
            {
                var user = new User
                {
                    Id = userGuid,
                    UserName = "mehmetlocal",
                    Email = "mehmetlocal@blinkr.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("postgres123"),
                    Role = "User",
                    CreatedAt = DateTime.UtcNow
                };
                _context.Users.Add(user);
            }

            // Sadece değişiklik varsa kaydet
            if (_context.ChangeTracker.HasChanges())
            {
                await _context.SaveChangesAsync();
            }
        }
    }
}
