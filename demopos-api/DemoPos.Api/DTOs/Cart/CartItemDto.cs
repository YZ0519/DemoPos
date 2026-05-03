namespace DemoPos.Api.DTOs.Cart;

/// <summary>
/// Represents a single row in the user's POS cart, enriched with product data.
/// RowTotal is computed server-side: product.DiscountedPrice * Quantity.
/// Bundle header rows carry the bundle price; sub-item rows carry the product price.
/// </summary>
public class CartItemDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string ProductSku { get; set; } = string.Empty;
    public string? ProductImage { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }           // original price (for strikethrough)
    public decimal DiscountedPrice { get; set; } // selling price
    public int StockQuantity { get; set; }        // product.Quantity (for increment cap)
    public decimal RowTotal { get; set; }         // DiscountedPrice * Quantity

    // ── Bundle support ────────────────────────────────────────────────────────
    public bool IsBundleHeader { get; set; } = false;
    public int? BundleHeaderPosCartId { get; set; }
    public int? ProductBundleId { get; set; }

    // ── Multi-step bundle support ────────────────────────────────────────────
    public int? BundleStepId { get; set; }
    public string? BundleStepLabel { get; set; }
}
