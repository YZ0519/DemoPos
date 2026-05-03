namespace DemoPos.Api.DTOs.Roles;

public class RoleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<string> Permissions { get; set; } = new();
}
