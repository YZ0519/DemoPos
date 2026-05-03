namespace DemoPos.Api.DTOs.Sales;

public class AddSaleItemRequest
{
    // Null when this entry represents a bundle (BundleId is set instead)
    public int? ProductId { get; set; }

    public int Quantity { get; set; } = 1;

    public decimal? OverriddenPrice { get; set; }

    public string? ModifierNote { get; set; }

    public decimal ItemDiscount { get; set; } = 0;

    public string? ItemDiscountType { get; set; } // "fixed" | "percentage"

    // Bundle fields — populated only when this entry represents a bundle
    public int? BundleId { get; set; }

    // Which bundle products to include as sub-items.
    // If null or empty the service will expand all BundleItems from the definition.
    public List<BundleProductSelection>? SelectedProducts { get; set; }
}

public class BundleProductSelection
{
    public int ProductId { get; set; }
    public int Quantity { get; set; } = 1;

    /// <summary>
    /// For multi-step bundles: the step this product selection belongs to.
    /// Null for flat (non-step) bundles.
    /// </summary>
    public int? BundleStepId { get; set; }
}
