using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IdentityService.Application.DTOs
{
    public class AuthResponse
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public int ExpiresIn { get; set; } // seconds
        public string? AvatarKey { get; set; }
        /// <summary>Set while the account waits to be deleted (F3): the app offers "Silmeyi geri al" instead of the map.</summary>
        public DateTime? DeletionScheduledForUtc { get; set; }
    }
}
