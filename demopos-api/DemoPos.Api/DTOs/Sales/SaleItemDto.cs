namespace DemoPos.Api.DTOs.Sales;

public class SaleItemDto
{
    public int Id { get; set; }
    public int? ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal SubTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }

    // Bundle fields
    public bool IsBundleHeader { get; set; }
    public int? BundleHeaderSaleItemId { get; set; }
    public int? ProductBundleId { get; set; }

    // Multi-step bundle fields
    public int? BundleStepId { get; set; }
    public string? BundleStepLabel { get; set; }

    // Restaurant / kitchen fields
    public DateTime? KitchenSentAt { get; set; }
    public string? ModifierNote { get; set; }
    public decimal? OverriddenPrice { get; set; }
    public decimal ItemDiscount { get; set; }
    public string? ItemDiscountType { get; set; }
    public bool IsVoided { get; set; }
    public DateTime? VoidedAt { get; set; }
}
