using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Roles;

public class UpdateRoleRequest
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
}
