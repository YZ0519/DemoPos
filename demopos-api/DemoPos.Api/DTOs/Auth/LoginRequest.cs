using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Auth;

public class LoginRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    /// <remarks>Not yet implemented — token expiry is fixed regardless of this value.</remarks>
    public bool RememberMe { get; set; } = false;
}
