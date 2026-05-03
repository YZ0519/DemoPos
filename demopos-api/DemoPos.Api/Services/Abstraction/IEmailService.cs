namespace DemoPos.Api.Services.Abstraction;

public interface IEmailService
{
    Task SendOtpEmailAsync(string toEmail, string otp, CancellationToken ct = default);
}
