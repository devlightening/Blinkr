
namespace IdentityService.Application.DTOs
{
    public class RegisterRequest
    {
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        /// <summary>Required for real sign-ups (plan-devam F5): under 13 cannot register, under 18 starts private.</summary>
        public int? BirthYear { get; set; }
    }
}
