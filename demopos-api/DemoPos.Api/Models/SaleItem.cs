namespace DemoPos.Api.Models;

public class SaleItem
{
    public int Id { get; set; }
    public int SaleId { get; set; }

    // Nullable: bundle header rows have no product of their own
    public int? ProductId { get; set; }

    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal SubTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // ── Bundle support ────────────────────────────────────────────────────────
    // IsBundleHeader = true  → this row is the bundle line on the invoice.
    //                          ProductId is null; Price is the bundle price.
    // BundleHeaderSaleItemId → links sub-item rows back to their header.
    // ProductBundleId        → the bundle definition this header was created from.
    public bool IsBundleHeader { get; set; } = false;
    public int? BundleHeaderSaleItemId { get; set; }
    public int? ProductBundleId { get; set; }

    // Multi-step bundle: which step this sub-item belongs to (null for flat bundles)
    public int? BundleStepId { get; set; }

    // ── Restaurant / kitchen fields ────────────────────────────────────────────
    public DateTime? KitchenSentAt { get; set; }
    public string? ModifierNote { get; set; }          // e.g. "no onions, medium rare"
    public decimal? OverriddenPrice { get; set; }      // cashier-edited unit price override
    public decimal ItemDiscount { get; set; } = 0;     // item-level discount amount
    public string? ItemDiscountType { get; set; }      // "fixed" | "percentage"
    public bool IsVoided { get; set; } = false;
    public DateTime? VoidedAt { get; set; }
    public int? VoidedByUserId { get; set; }

    // Navigation
    public Sale Sale { get; set; } = null!;
    public Product? Product { get; set; }
    public SaleItem? BundleHeaderSaleItem { get; set; }
    public ProductBundle? ProductBundle { get; set; }
    public BundleStep? BundleStep { get; set; }
    public User? VoidedByUser { get; set; }
}
