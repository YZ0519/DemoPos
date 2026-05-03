namespace DemoPos.Api.Models;

public class PosCart
{
    public int Id { get; set; }
    public int UserId { get; set; }

    // Nullable: bundle header rows have no product of their own
    public int? ProductId { get; set; }

    public int Quantity { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // ── Bundle support ────────────────────────────────────────────────────────
    // IsBundleHeader = true  → this is the top-level bundle row in the cart.
    //                          ProductId is null; ProductBundleId holds the definition.
    // BundleHeaderPosCartId  → links sub-item cart rows back to their header row.
    // ProductBundleId        → the bundle definition (only set on header rows).
    public bool IsBundleHeader { get; set; } = false;
    public int? BundleHeaderPosCartId { get; set; }
    public int? ProductBundleId { get; set; }

    // Multi-step bundle: which step this sub-item belongs to (null for flat bundles)
    public int? BundleStepId { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Product? Product { get; set; }
    public PosCart? BundleHeaderPosCart { get; set; }
    public ProductBundle? ProductBundle { get; set; }
    public BundleStep? BundleStep { get; set; }
}
