using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Users;

public class UpdateProfileRequest
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    public string? CurrentPassword { get; set; }

    [MinLength(6)]
    public string? NewPassword { get; set; }

    [Compare(nameof(NewPassword), ErrorMessage = "Password confirmation does not match the new password.")]
    public string? NewPasswordConfirmation { get; set; }
}
