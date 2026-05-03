namespace DemoPos.Api.DTOs.Settings;

public class UpdateContactSettingsRequest
{
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactAddress { get; set; }
    public string? ContactFax { get; set; }
    public string? ContactMobile { get; set; }
    public string? WorkingHour { get; set; }
}
