namespace DemoPos.Api.DTOs.PaymentMethods;

public class CreatePaymentMethodRequest
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;
    public int SortOrder { get; set; } = 0;
    public bool AutoFillAmount { get; set; } = false;
    public bool ZeroTotal { get; set; } = false;
}
