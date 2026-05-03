namespace DemoPos.Api.Models;

public class ProductBundle
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int MinItems { get; set; } = 1;
    public int MaxItems { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation — header SaleItems that were created from this bundle definition
    public ICollection<SaleItem> HeaderItems { get; set; } = new List<SaleItem>();

    // Navigation — multi-step selection steps
    public ICollection<BundleStep> Steps { get; set; } = new List<BundleStep>();

    // Computed — true when the bundle uses the step-based selection flow
    public bool HasSteps => Steps != null && Steps.Count > 0;
}
