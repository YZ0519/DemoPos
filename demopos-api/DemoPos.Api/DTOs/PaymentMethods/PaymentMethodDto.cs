namespace DemoPos.Api.DTOs.PaymentMethods;

public class PaymentMethodDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
    public int SortOrder { get; set; }
    public bool AutoFillAmount { get; set; }
    public bool ZeroTotal { get; set; }
    public DateTime CreatedAt { get; set; }
}
