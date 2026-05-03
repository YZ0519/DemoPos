namespace DemoPos.Api.Models;

public class VoucherPackage
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;       // unique, stored UPPER
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string DiscountType { get; set; } = "fixed";    // "fixed" | "percentage" | "override"
    public decimal DiscountValue { get; set; } = 0;
    public string AppliesTo { get; set; } = "all";          // "all" | "specific_items"
    public bool IsActive { get; set; } = true;
    public DateTime? ValidFrom { get; set; }
    public DateTime? ValidUntil { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<VoucherPackageItem> Items { get; set; } = new();
}
