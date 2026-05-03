namespace DemoPos.Api.Models;

public class ForgetPassword
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Email { get; set; } = string.Empty;
    public string Otp { get; set; } = string.Empty;
    public string? ResetToken { get; set; }
    public int ResentCount { get; set; } = 0;
    public DateTime SuspendDuration { get; set; }
}
