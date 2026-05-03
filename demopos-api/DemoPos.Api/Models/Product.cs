using DemoPos.Api.Constants;

namespace DemoPos.Api.Models;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Description { get; set; }

    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    public int? BrandId { get; set; }
    public Brand? Brand { get; set; }

    public int? UnitId { get; set; }
    public Unit? Unit { get; set; }

    public decimal Price { get; set; } = 0m;
    public decimal? Discount { get; set; }
    /// <summary>'fixed' or 'percentage'</summary>
    public string? DiscountType { get; set; }
    public decimal PurchasePrice { get; set; } = 0m;
    public int Quantity { get; set; } = 0;
    public DateOnly? ExpireDate { get; set; }
    public bool Status { get; set; } = true;
    /// <summary>
    /// When true, this product is eligible to appear in the POS Terminal.
    /// Must also satisfy Status=true AND Quantity>=1 for POS display.
    /// Defaults to false (opt-in model).
    /// </summary>
    public bool PosEnabled { get; set; } = false;
    public string? Image { get; set; }

    /// <summary>
    /// When set, purchasing this product automatically triggers a split or
    /// production assembly using this template. Null means auto-assembly is off.
    /// </summary>
    public int? AutoAssemblyTemplateId { get; set; }
    public AssemblyTemplate? AutoAssemblyTemplate { get; set; }

    /// <summary>
    /// "standard" — regular product with its own stock.
    /// "combo"    — a meal-deal / combo whose stock is deducted from its ComboItems components.
    /// </summary>
    public string ProductType { get; set; } = ProductTypes.Standard;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Final selling price after applying any discount.
    /// Computed in-memory — not persisted to the database.
    /// </summary>
    public decimal DiscountedPrice => DiscountType switch
    {
        DiscountTypes.Fixed      when Discount.HasValue => Math.Round(Price - Discount.Value, 2),
        DiscountTypes.Percentage when Discount.HasValue => Math.Round(Price - (Price * Discount.Value / 100), 2),
        _ => Price
    };

    // Navigation
    public ICollection<ProductModifierGroup> ModifierGroups { get; set; } = new List<ProductModifierGroup>();

    /// <summary>
    /// Components consumed when this product (ProductType="combo") is sold.
    /// Empty for standard products.
    /// </summary>
    public ICollection<ComboItem> ComboItems { get; set; } = new List<ComboItem>();
}
