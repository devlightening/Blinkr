using IdentityService.Application.DTOs;

namespace IdentityService.Application.Interfaces;

public interface IUserService
{
    Task<Guid> RegisterAsync(RegisterUserDto dto);
    Task<string> LoginAsync(string email, string password);
}
