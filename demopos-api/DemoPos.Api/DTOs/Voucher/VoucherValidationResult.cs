namespace DemoPos.Api.DTOs.Voucher;

public class VoucherValidationResult
{
    public bool IsValid { get; set; }
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? DiscountType { get; set; }
    public decimal? DiscountValue { get; set; }
    public string? AppliesTo { get; set; }
    public List<VoucherItemOverride> Items { get; set; } = new();
    public string? Message { get; set; }
}

public class VoucherItemOverride
{
    public int ProductId { get; set; }
    public decimal? OverridePrice { get; set; }
}
