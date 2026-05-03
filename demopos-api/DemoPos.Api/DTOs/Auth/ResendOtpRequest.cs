using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Auth;

public class ResendOtpRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;
}
