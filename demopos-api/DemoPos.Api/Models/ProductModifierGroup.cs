namespace DemoPos.Api.Models;

public class ProductModifierGroup
{
    public int Id { get; set; }
    public int ProductId { get; set; }

    /// <summary>e.g. "Doneness", "Add-ons", "Size"</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>When true, the customer must select at least MinSelections before ordering.</summary>
    public bool IsRequired { get; set; } = false;

    public int MinSelections { get; set; } = 0;
    public int MaxSelections { get; set; } = 1;
    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Product? Product { get; set; }
    public ICollection<ProductModifierOption> Options { get; set; } = new List<ProductModifierOption>();
}
