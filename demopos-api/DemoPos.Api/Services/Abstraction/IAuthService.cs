using DemoPos.Api.DTOs.Auth;

namespace DemoPos.Api.Services.Abstraction;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request, HttpResponse response, CancellationToken ct = default);
    Task<AuthResponse> RegisterAsync(RegisterRequest request, HttpResponse response, CancellationToken ct = default);
    Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default);
    Task<string> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken ct = default);
    Task ResendOtpAsync(ResendOtpRequest request, CancellationToken ct = default);
    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);

    /// <summary>
    /// Validates the raw refresh token, issues a new access_token cookie, and rotates the refresh token.
    /// Returns the new access token string on success, or null if the token is invalid/expired.
    /// </summary>
    Task<string?> RefreshAccessTokenAsync(string refreshTokenValue, HttpResponse response, CancellationToken ct = default);

    /// <summary>
    /// Revokes all refresh tokens for the given user and clears auth cookies.
    /// </summary>
    Task LogoutAsync(int userId, HttpResponse response, CancellationToken ct = default);
}
