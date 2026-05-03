using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Auth;

public class ResetPasswordRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string ResetToken { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [Compare(nameof(Password), ErrorMessage = "Passwords do not match")]
    public string PasswordConfirmation { get; set; } = string.Empty;
}
