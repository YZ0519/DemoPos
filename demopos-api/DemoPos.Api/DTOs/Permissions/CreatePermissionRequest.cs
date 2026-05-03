using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Permissions;

public class CreatePermissionRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Permission creation type.
    /// 1 = single permission (default).
    /// 2 = creates four CRUD variants: {name}_view, {name}_create, {name}_update, {name}_delete.
    /// </summary>
    public int Type { get; set; } = 1;
}
