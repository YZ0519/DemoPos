using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Permissions;

public class UpdatePermissionRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;
}
