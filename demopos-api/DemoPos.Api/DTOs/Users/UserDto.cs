namespace DemoPos.Api.DTOs.Users;

public class UserDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? ProfileImage { get; set; }
    public string? Role { get; set; }
    public int? RoleId { get; set; }
    public bool IsSuspended { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<string> Permissions { get; set; } = new();
}
