namespace DemoPos.Api.DTOs.Voucher;

public class VoucherPackageDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string DiscountType { get; set; } = "fixed";
    public decimal DiscountValue { get; set; }
    public string AppliesTo { get; set; } = "all";
    public bool IsActive { get; set; }
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public List<VoucherPackageItemDto> Items { get; set; } = new();
}

public class VoucherPackageItemDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal? OverridePrice { get; set; }
}
