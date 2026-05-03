namespace DemoPos.Api.Models;

/// <summary>
/// Defines one component product inside a combo/meal-deal product.
/// When a combo product is sold, stock is deducted from each component
/// rather than from the combo product itself.
/// </summary>
public class ComboItem
{
    public int Id { get; set; }

    /// <summary>The combo product this component belongs to (ProductType="combo").</summary>
    public int ComboProductId { get; set; }

    /// <summary>The ingredient/component product whose stock is deducted when the combo is sold.</summary>
    public int ComponentProductId { get; set; }

    /// <summary>How much of the component is consumed per single combo unit sold.</summary>
    public decimal Quantity { get; set; } = 1;

    public int SortOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Product? ComboProduct { get; set; }
    public Product? ComponentProduct { get; set; }
}
