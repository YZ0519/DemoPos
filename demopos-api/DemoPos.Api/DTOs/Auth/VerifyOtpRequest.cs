using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Auth;

public class VerifyOtpRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Otp { get; set; } = string.Empty;
}
