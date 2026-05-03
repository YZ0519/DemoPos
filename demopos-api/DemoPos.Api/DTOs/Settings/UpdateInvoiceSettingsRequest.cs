namespace DemoPos.Api.DTOs.Settings;

public class UpdateInvoiceSettingsRequest
{
    public string? NoteToCustomer { get; set; }

    /// <summary>Receipt width: "small" | "medium" | "large".</summary>
    public string? ReceiptMaxWidth { get; set; }

    public bool IsShowLogo { get; set; }
    public bool IsShowSiteName { get; set; }
    public bool IsShowPhone { get; set; }
    public bool IsShowEmail { get; set; }
    public bool IsShowAddress { get; set; }
    public bool IsShowCustomer { get; set; }
    public bool IsShowNote { get; set; }
}
