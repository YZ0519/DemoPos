using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using DemoPos.Api.DTOs.Auth;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public class AuthController(IAuthService auth, IAuditService audit) : ControllerBase
{
    private int CurrentUserId
    {
        get
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? User.FindFirstValue("sub");
            return int.TryParse(raw, out var id) ? id : 0;
        }
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        CancellationToken ct)
    {
        var result = await auth.LoginAsync(request, Response, ct);

        // Audit successful login (failure throws UnauthorizedAccessException before reaching here)
        await audit.LogAsync(
            "LOGIN", "User", result.User.Id.ToString(),
            $"User '{result.User.Email}' logged in",
            result.User.Id, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        // Return user data only — the JWT is set as an httpOnly cookie by the service.
        return Ok(new { success = true, data = new { user = result.User } });
    }

    [HttpPost("register")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken ct)
    {
        return Task.FromResult<IActionResult>(
            StatusCode(StatusCodes.Status403Forbidden,
                new { success = false, message = "Registration is disabled. Contact your administrator." }));
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        CancellationToken ct)
    {
        await auth.ForgotPasswordAsync(request, ct);
        return Ok(new { success = true, message = "OTP sent to your email" });
    }

    [HttpPost("verify-otp")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyOtp(
        [FromBody] VerifyOtpRequest request,
        CancellationToken ct)
    {
        var resetToken = await auth.VerifyOtpAsync(request, ct);
        return Ok(new { success = true, data = new { resetToken } });
    }

    [HttpPost("resend-otp")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResendOtp(
        [FromBody] ResendOtpRequest request,
        CancellationToken ct)
    {
        await auth.ResendOtpAsync(request, ct);
        return Ok(new { success = true, message = "OTP resent" });
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        CancellationToken ct)
    {
        await auth.ResetPasswordAsync(request, ct);
        return Ok(new { success = true, message = "Password reset successfully" });
    }

    [HttpPost("refresh")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        var refreshToken = Request.Cookies["refresh_token"];
        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(new { success = false, message = "No refresh token" });

        var result = await auth.RefreshAccessTokenAsync(refreshToken, Response, ct);
        if (result == null)
            return Unauthorized(new { success = false, message = "Invalid or expired refresh token" });

        return Ok(new { success = true });
    }

    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        int userId = CurrentUserId;
        await auth.LogoutAsync(userId, Response, ct);

        await audit.LogAsync(
            "LOGOUT", "User", userId.ToString(),
            $"User #{userId} logged out",
            userId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return Ok(new { success = true, message = "Logged out successfully" });
    }
}
