using IdentityService.Application.DTOs;
using IdentityService.Application.Interfaces;
using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _db;

    public UserService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<Guid> RegisterAsync(RegisterUserDto dto)
    {
        var user = new User
        {
            UserName = dto.UserName,
            Email = dto.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return user.Id;
    }

    public async Task<string> LoginAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid credentials");

        // Şimdilik JWT üretmiyoruz, sadece dummy token dönelim
        return $"TOKEN_{user.Id}";
    }
}
