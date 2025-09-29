using IdentityService.Application.DTOs;

namespace IdentityService.Application.Interfaces
{
    public interface IUserService
    {
        Task<AuthResponse?> RegisterAsync(RegisterRequest request);
        Task<AuthResponse?> LoginAsync(LoginRequest request);
    }
}
