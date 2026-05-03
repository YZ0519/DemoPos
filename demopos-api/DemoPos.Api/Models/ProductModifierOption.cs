namespace DemoPos.Api.Models;

public class ProductModifierOption
{
    public int Id { get; set; }
    public int ModifierGroupId { get; set; }

    /// <summary>e.g. "Rare", "Medium Well", "Extra Cheese"</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// 0 = free add-on, positive = extra charge applied on top of base price.
    /// Informational in Phase 4 — not yet applied to sale item totals.
    /// </summary>
    public decimal PriceAdjustment { get; set; } = 0;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ProductModifierGroup? ModifierGroup { get; set; }
}
