using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

/// <summary>
/// Generates signed JWT access tokens.
/// TimeProvider is injected for testability — tests can substitute a fixed clock.
/// </summary>
public class JwtService(IConfiguration config, TimeProvider timeProvider) : IJwtService
{
    // JwtSecurityTokenHandler is thread-safe; cache the instance to avoid
    // re-initialisation overhead on every token generation call.
    private static readonly JwtSecurityTokenHandler TokenHandler = new();

    // Cache the signing key and config values — resolved once at construction.
    // Environment variable takes priority over appsettings.json (same as Program.cs).
    private readonly SymmetricSecurityKey _signingKey =
        new(Encoding.UTF8.GetBytes(
            Environment.GetEnvironmentVariable("DEMOPOS_JWT_KEY")
                ?? config["Jwt:Key"]
                ?? throw new InvalidOperationException(
                    "JWT signing key is not configured. Set DEMOPOS_JWT_KEY environment variable.")));

    private readonly string _issuer =
        config["Jwt:Issuer"] ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");

    private readonly string _audience =
        config["Jwt:Audience"] ?? throw new InvalidOperationException("Jwt:Audience is not configured.");

    private readonly double _expiryHours =
        double.TryParse(config["Jwt:ExpiryHours"], out var h) ? h : 24;

    public string GenerateToken(User user, IList<string> permissions)
    {
        var creds = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var expiry = now.AddHours(_expiryHours);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
            new("name",         user.Name),
            new("role",         user.Role?.Name ?? string.Empty),
            new("roleId",       user.RoleId?.ToString() ?? string.Empty),
            new("profileImage", user.ProfileImage ?? string.Empty),
            new("permissions",  string.Join(",", permissions)),
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            notBefore: now,
            expires: expiry,
            signingCredentials: creds
        );

        return TokenHandler.WriteToken(token);
    }
}
