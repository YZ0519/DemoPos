namespace DemoPos.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? ProfileImage { get; set; }
    public bool IsSuspended { get; set; } = false;
    public DateTime? EmailVerifiedAt { get; set; }
    public string? RememberToken { get; set; }
    public int? RoleId { get; set; }
    public Role? Role { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
