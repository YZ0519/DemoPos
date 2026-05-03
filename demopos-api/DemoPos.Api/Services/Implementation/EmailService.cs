using DemoPos.Api.Services.Abstraction;
using MailKit.Net.Smtp;
using MimeKit;

namespace DemoPos.Api.Services.Implementation;

/// <summary>
/// Sends transactional emails via SMTP (MailKit).
/// When SMTP is not configured, OTPs are logged at Information level for local development.
/// </summary>
public class EmailService(IConfiguration config, ILogger<EmailService> logger) : IEmailService
{
    // Resolve once at construction — avoids repeated config lookups on every send.
    private readonly string _host = config["Email:Host"] ?? string.Empty;
    private readonly int _port = int.TryParse(config["Email:Port"], out var p) ? p : 587;
    private readonly string _username = config["Email:Username"] ?? string.Empty;
    private readonly string _password = config["Email:Password"] ?? string.Empty;
    private readonly string _fromEmail = config["Email:FromEmail"] ?? "noreply@demopos.com";
    private readonly string _fromName = config["Email:FromName"] ?? "DemoPos System";

    public async Task SendOtpEmailAsync(string toEmail, string otp, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_fromName, _fromEmail));
        message.To.Add(new MailboxAddress(string.Empty, toEmail));
        message.Subject = "Your ClaudePos Password Reset OTP";

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = $"""
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
                    <h2 style="color: #1d4ed8; margin-bottom: 8px;">ClaudePos Password Reset</h2>
                    <p style="color: #6b7280;">Use the following one-time code to reset your password. It expires in <strong>5 minutes</strong>.</p>
                    <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; text-align: center; margin: 24px 0; padding: 16px; background: #eff6ff; border-radius: 8px; color: #1d4ed8;">
                        {otp}
                    </div>
                    <p style="color: #9ca3af; font-size: 12px;">If you did not request a password reset, ignore this email.</p>
                </div>
            """
        };
        message.Body = bodyBuilder.ToMessageBody();

        // If SMTP is not configured, log the OTP for development convenience and exit.
        if (string.IsNullOrEmpty(_host) || string.IsNullOrEmpty(_username))
        {
            logger.LogInformation("DEV MODE — OTP for {Email}: {Otp}", toEmail, otp);
            return;
        }

        using var client = new SmtpClient();
        await client.ConnectAsync(_host, _port, MailKit.Security.SecureSocketOptions.StartTls, ct);
        await client.AuthenticateAsync(_username, _password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
