using IdentityService.Application.DTOs;

namespace IdentityService.Application.Interfaces
{
    public interface IUserService
    {
        Task<RegisterResult> RegisterAsync(RegisterRequest request);
        Task<AuthResponse?> LoginAsync(LoginRequest request);
        Task<AuthResponse?> RefreshTokenAsync(string refreshToken);
        Task<UserResponse?> GetUserByIdAsync(Guid userId);
        /// <summary>Sets (or clears, with null) the avatar. False when the user does not exist.</summary>
        Task<bool> SetAvatarAsync(Guid userId, string? avatarKey);
    }

    public class UserResponse
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? AvatarKey { get; set; }
        public string? Bio { get; set; }
        public int FriendCount { get; set; }
        public int IncomingRequestCount { get; set; }
    }
}
