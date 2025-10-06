using BlogService.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace BlogService.Infrastructure.Services
{
    public sealed class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _http;

        public CurrentUserService(IHttpContextAccessor http) => _http = http;

        public Guid? UserId
        {
            get
            {
                var user = _http.HttpContext?.User;
                if (user is null || !user.Identity?.IsAuthenticated == true) return null;

                // sub (preferred) → NameIdentifier fallback
                var sub = user.FindFirstValue("sub")
                       ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

                return Guid.TryParse(sub, out var id) ? id : null;
            }
        }

        public bool IsInRole(string role)
        {
            var user = _http.HttpContext?.User;
            return user?.IsInRole(role) ?? false;
        }
    }
}
