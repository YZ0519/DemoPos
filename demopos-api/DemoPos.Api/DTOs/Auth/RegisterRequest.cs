using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Auth;

public class RegisterRequest
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [Compare(nameof(Password), ErrorMessage = "Passwords do not match")]
    public string PasswordConfirmation { get; set; } = string.Empty;
}
