using IdentityService.Application.DTOs;
using IdentityService.Application.Interfaces;
using IdentityService.Domain.Entities;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using Shared.Auth;

namespace IdentityService.Infrastructure.Services
{
    public class UserService : IUserService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public UserService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
        {
            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
                return null;

            var user = new User
            {
                UserName = request.UserName,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return await GenerateAuthResponseAsync(user);
        }

        public async Task<AuthResponse?> LoginAsync(LoginRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.UserName);
            if (user == null) return null;

            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return null;

            return await GenerateAuthResponseAsync(user);
        }

        public async Task<AuthResponse?> RefreshTokenAsync(string refreshToken)
        {
            try
            {
                var jwt = BlinkrJwtOptions.FromConfiguration(_config);
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.UTF8.GetBytes(jwt.SigningKey);

                var validationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(key),
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateLifetime = true,
                    ClockSkew = jwt.ClockSkew,
                    NameClaimType = BlinkrJwtOptions.CanonicalUserIdClaim,
                    RoleClaimType = BlinkrJwtOptions.RoleClaimType,
                    AlgorithmValidator = (algorithm, _, _, _) =>
                        algorithm == SecurityAlgorithms.HmacSha256 ||
                        algorithm == SecurityAlgorithms.HmacSha256Signature
                };

                var principal = tokenHandler.ValidateToken(refreshToken, validationParameters, out var validatedToken);
                if (validatedToken is not JwtSecurityToken jwtToken ||
                    !string.Equals(jwtToken.Header.Alg, SecurityAlgorithms.HmacSha256, StringComparison.OrdinalIgnoreCase))
                {
                    return null;
                }

                if (principal.FindFirst("token_use")?.Value != "refresh")
                    return null;

                var userIdClaim = principal.FindFirst(BlinkrJwtOptions.CanonicalUserIdClaim)?.Value
                                  ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
                    return null;

                var user = await _context.Users.FindAsync(userId);
                if (user == null) return null;

                var incomingHash = HashToken(refreshToken);
                var storedToken = await _context.RefreshTokens
                    .FirstOrDefaultAsync(t => t.UserId == userId && t.TokenHash == incomingHash);

                if (storedToken is null || !storedToken.IsActive)
                    return null;

                var response = await GenerateAuthResponseAsync(user, persistRefreshToken: false);
                var replacementHash = HashToken(response.RefreshToken);
                storedToken.RevokedAtUtc = DateTime.UtcNow;
                storedToken.ReplacedByTokenHash = replacementHash;
                _context.RefreshTokens.Add(new RefreshToken
                {
                    UserId = user.Id,
                    TokenHash = replacementHash,
                    ExpiresAtUtc = DateTime.UtcNow.Add(jwt.RefreshTokenLifetime)
                });
                await _context.SaveChangesAsync();

                return response;
            }
            catch
            {
                return null;
            }
        }

        public async Task<UserResponse?> GetUserByIdAsync(Guid userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return null;

            return new UserResponse
            {
                UserId = user.Id,
                UserName = user.UserName,
                Email = user.Email
            };
        }

        private async Task<AuthResponse> GenerateAuthResponseAsync(User user, bool persistRefreshToken = true)
        {
            var jwt = BlinkrJwtOptions.FromConfiguration(_config);
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(jwt.SigningKey);
            var now = DateTime.UtcNow;
            var expiresAt = now.Add(jwt.AccessTokenLifetime);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(JwtRegisteredClaimNames.Email, user.Email),
                    new Claim(ClaimTypes.Email, user.Email),
                    new Claim(BlinkrJwtOptions.RoleClaimType, user.Role),
                    new Claim(ClaimTypes.Role, user.Role),
                    new Claim("username", user.UserName),
                    new Claim("preferred_username", user.UserName),
                    new Claim(BlinkrJwtOptions.ScopeClaimType, "blinkr.api.read blinkr.api.write"),
                    new Claim("token_use", "access"),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                    new Claim(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now).ToString(), ClaimValueTypes.Integer64)
                }),
                Expires = expiresAt,
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature
                ),
                Audience = jwt.Audience,
                Issuer = jwt.Issuer
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            // Generate refresh token (longer expiry)
            var refreshTokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim("token_use", "refresh"),
                    new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
                    new Claim(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now).ToString(), ClaimValueTypes.Integer64)
                }),
                Expires = now.Add(jwt.RefreshTokenLifetime),
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature
                ),
                Audience = jwt.Audience,
                Issuer = jwt.Issuer
            };

            var refreshToken = tokenHandler.CreateToken(refreshTokenDescriptor);
            var refreshTokenValue = tokenHandler.WriteToken(refreshToken);

            if (persistRefreshToken)
            {
                _context.RefreshTokens.Add(new RefreshToken
                {
                    UserId = user.Id,
                    TokenHash = HashToken(refreshTokenValue),
                    ExpiresAtUtc = now.Add(jwt.RefreshTokenLifetime)
                });
                await _context.SaveChangesAsync();
            }

            return new AuthResponse
            {
                UserId = user.Id,
                UserName = user.UserName,
                Email = user.Email,
                Token = tokenHandler.WriteToken(token),
                RefreshToken = refreshTokenValue,
                ExpiresIn = (int)jwt.AccessTokenLifetime.TotalSeconds
            };
        }

        private static string HashToken(string token)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            return Convert.ToHexString(bytes);
        }
    }
}
