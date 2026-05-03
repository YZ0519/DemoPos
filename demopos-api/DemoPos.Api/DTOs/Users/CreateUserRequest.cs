using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Users;

public class CreateUserRequest
{
    [Required]
    [StringLength(100, MinimumLength = 1)]
    public string Name { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "A valid role must be selected")]
    public int RoleId { get; set; }
}
