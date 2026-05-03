using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Users;

public class UpdateUserRequest
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "A valid role must be selected")]
    public int RoleId { get; set; }

    /// <summary>
    /// Optional. When supplied and non-empty the user's password is changed.
    /// When omitted or empty the existing password is preserved.
    /// </summary>
    [MinLength(6, ErrorMessage = "Password must be at least 6 characters")]
    public string? Password { get; set; }
}
