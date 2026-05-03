namespace DemoPos.Api.Models;

public class PaymentMethod
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;
    public int SortOrder { get; set; } = 0;
    public bool AutoFillAmount { get; set; } = false;
    public bool ZeroTotal { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
