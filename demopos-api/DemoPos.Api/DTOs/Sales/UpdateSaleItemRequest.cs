namespace DemoPos.Api.DTOs.Sales;

/// <summary>
/// Partial-update payload for a single open-order sale item (R2 — Open Orders).
/// Distinct from UpdateSaleItemRequest (in UpdateSaleRequest.cs) which handles bulk
/// POS-style sale line replacements.
/// </summary>
public class PatchSaleItemRequest
{
    public int? Quantity { get; set; }
    public decimal? OverriddenPrice { get; set; }
    public string? ModifierNote { get; set; }
    public decimal? ItemDiscount { get; set; }
    public string? ItemDiscountType { get; set; } // "fixed" | "percentage"
}
