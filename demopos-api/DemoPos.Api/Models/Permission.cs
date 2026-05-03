namespace DemoPos.Api.Models;

public class Permission
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<RolePermission> RolePermissions { get; set; } = new List<RolePermission>();
}
