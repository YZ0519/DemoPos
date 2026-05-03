using System.Security.Cryptography;
using System.Text;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Auth;
using DemoPos.Api.DTOs.Users;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class AuthService(
    AppDbContext db,
    IJwtService jwt,
    IEmailService email,
    IMapper mapper,
    IConfiguration config) : IAuthService
{
    // Maximum number of times a user may request a new OTP for the same email
    // before they must restart the forgot-password flow.
    private const int MaxOtpResends = 5;

    // Refresh tokens expire after 7 days.
    private const int RefreshTokenExpiryDays = 7;

    public async Task<AuthResponse> LoginAsync(
        LoginRequest request,
        HttpResponse response,
        CancellationToken ct = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // AsNoTracking — this user object is never mutated during login.
        var user = await db.Users
            .AsNoTracking()
            .Include(u => u.Role)
                .ThenInclude(r => r!.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);

        // Use the same error message for both "not found" and "wrong password"
        // to prevent user enumeration.
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Incorrect email or password");

        if (user.IsSuspended)
            throw new UnauthorizedAccessException("Your account is temporarily suspended");

        var permissions = user.Role?.RolePermissions
            .Select(rp => rp.Permission.Name)
            .ToList() ?? [];

        var token = jwt.GenerateToken(user, permissions);

        // Set JWT as httpOnly cookie
        SetAccessTokenCookie(response, token);

        // Generate and store a refresh token
        await IssueRefreshTokenAsync(user.Id, response, ct);

        return new AuthResponse { Token = token, User = mapper.Map<UserDto>(user) };
    }

    public async Task<AuthResponse> RegisterAsync(
        RegisterRequest request,
        HttpResponse response,
        CancellationToken ct = default)
    {
        if (request.Password != request.PasswordConfirmation)
            throw new ArgumentException("Passwords do not match");

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail, ct))
            throw new ArgumentException("Email is already taken");

        // Load the role so we can embed the role name in the response DTO
        // without an additional round-trip after SaveChanges.
        var userRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "User", ct);
        if (userRole == null)
        {
            userRole = new Role { Name = "User" };
            db.Roles.Add(userRole);
            // Must save here so userRole.Id is populated before assigning to User.
            await db.SaveChangesAsync(ct);
        }

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = normalizedEmail,
            Username = Guid.NewGuid().ToString("N")[..12],
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            RoleId = userRole.Id,
            Role = userRole,
            EmailVerifiedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        // The tracked entity already has Role populated — no second DB query needed.
        // The new user has no permissions (User role has none by default).
        var token = jwt.GenerateToken(user, []);

        // Set JWT as httpOnly cookie
        SetAccessTokenCookie(response, token);

        // Generate and store a refresh token
        await IssueRefreshTokenAsync(user.Id, response, ct);

        return new AuthResponse { Token = token, User = mapper.Map<UserDto>(user) };
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct);

        // Do NOT reveal whether the email exists — always return success to the caller.
        // Only proceed with OTP generation when the user actually exists.
        if (user == null)
            return;

        var otp = GenerateOtp();
        var expiry = DateTime.UtcNow.AddMinutes(5);

        var existing = await db.ForgetPasswords.FirstOrDefaultAsync(fp => fp.UserId == user.Id, ct);
        if (existing != null)
        {
            existing.Otp = otp;
            existing.ResetToken = null;
            existing.SuspendDuration = expiry;
            existing.ResentCount = 0;
        }
        else
        {
            db.ForgetPasswords.Add(new ForgetPassword
            {
                UserId = user.Id,
                Email = normalizedEmail,
                Otp = otp,
                SuspendDuration = expiry,
            });
        }

        await db.SaveChangesAsync(ct);
        await email.SendOtpEmailAsync(normalizedEmail, otp, ct);
    }

    public async Task<string> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken ct = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var record = await db.ForgetPasswords
            .FirstOrDefaultAsync(fp => fp.Email == normalizedEmail && fp.Otp == request.Otp, ct);

        if (record == null)
            throw new ArgumentException("Invalid OTP");

        if (record.SuspendDuration < DateTime.UtcNow)
            throw new ArgumentException("OTP has expired. Please request a new one");

        var resetToken = Guid.NewGuid().ToString("N");
        record.ResetToken = resetToken;
        await db.SaveChangesAsync(ct);

        return resetToken;
    }

    public async Task ResendOtpAsync(ResendOtpRequest request, CancellationToken ct = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var record = await db.ForgetPasswords
            .FirstOrDefaultAsync(fp => fp.Email == normalizedEmail, ct)
            ?? throw new KeyNotFoundException("No OTP request found for this email");

        if (record.ResentCount >= MaxOtpResends)
            throw new InvalidOperationException(
                "Maximum OTP resend limit reached. Please start the forgot-password process again");

        var otp = GenerateOtp();
        record.Otp = otp;
        record.ResetToken = null;
        record.ResentCount++;
        record.SuspendDuration = DateTime.UtcNow.AddMinutes(5);
        await db.SaveChangesAsync(ct);

        await email.SendOtpEmailAsync(normalizedEmail, otp, ct);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        if (request.Password != request.PasswordConfirmation)
            throw new ArgumentException("Passwords do not match");

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var record = await db.ForgetPasswords
            .FirstOrDefaultAsync(fp => fp.Email == normalizedEmail && fp.ResetToken == request.ResetToken, ct)
            ?? throw new ArgumentException("Invalid or expired reset token");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail, ct)
            ?? throw new KeyNotFoundException("User not found");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        user.UpdatedAt = DateTime.UtcNow;
        db.ForgetPasswords.Remove(record);
        await db.SaveChangesAsync(ct);
    }

    public async Task<string?> RefreshAccessTokenAsync(
        string refreshTokenValue,
        HttpResponse response,
        CancellationToken ct = default)
    {
        // Hash the raw token value to look it up in the DB
        var hash = HashToken(refreshTokenValue);

        var storedToken = await db.RefreshTokens
            .Include(rt => rt.User)
                .ThenInclude(u => u.Role)
                    .ThenInclude(r => r!.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(rt => rt.TokenHash == hash, ct);

        if (storedToken == null || storedToken.IsRevoked || storedToken.ExpiresAt < DateTime.UtcNow)
            return null;

        var user = storedToken.User;

        var permissions = user.Role?.RolePermissions
            .Select(rp => rp.Permission.Name)
            .ToList() ?? [];

        // Issue new access token
        var newAccessToken = jwt.GenerateToken(user, permissions);
        SetAccessTokenCookie(response, newAccessToken);

        // Rotate refresh token: revoke old, issue new
        storedToken.IsRevoked = true;
        await db.SaveChangesAsync(ct);

        await IssueRefreshTokenAsync(user.Id, response, ct);

        return newAccessToken;
    }

    public async Task LogoutAsync(int userId, HttpResponse response, CancellationToken ct = default)
    {
        // Revoke all refresh tokens for this user
        var tokens = await db.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync(ct);

        foreach (var t in tokens)
            t.IsRevoked = true;

        await db.SaveChangesAsync(ct);

        // Clear auth cookies
        response.Cookies.Delete("access_token");
        response.Cookies.Delete("refresh_token");
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /// <summary>
    /// Generates and persists a new refresh token, then sets it as an httpOnly cookie.
    /// The raw (unhashed) token goes in the cookie; only the SHA-256 hash is stored in the DB.
    /// </summary>
    private async Task IssueRefreshTokenAsync(int userId, HttpResponse response, CancellationToken ct)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var hashedToken = HashToken(rawToken);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = userId,
            TokenHash = hashedToken,
            ExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpiryDays),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);

        response.Cookies.Append("refresh_token", rawToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(RefreshTokenExpiryDays),
            // Scope to the refresh endpoint only to reduce the surface area exposed
            // by having the refresh cookie sent on every API request.
            Path = "/api/auth",
        });
    }

    /// <summary>Sets the access_token httpOnly cookie on the response.</summary>
    private void SetAccessTokenCookie(HttpResponse response, string token)
    {
        var expiryHours = double.TryParse(config["Jwt:ExpiryHours"], out var h) ? h : 24;

        response.Cookies.Append("access_token", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddHours(expiryHours),
            Path = "/",
        });
    }

    /// <summary>Returns the URL-safe Base64 SHA-256 hash of a raw token string.</summary>
    private static string HashToken(string rawToken)
        => Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

    /// <summary>
    /// Generates a cryptographically random 5-digit OTP.
    /// <c>Random.Next</c> is NOT suitable for security-sensitive values.
    /// </summary>
    private static string GenerateOtp()
    {
        // Produces a uniform random integer in [10000, 99999]
        var value = RandomNumberGenerator.GetInt32(10000, 100000);
        return value.ToString();
    }
}
