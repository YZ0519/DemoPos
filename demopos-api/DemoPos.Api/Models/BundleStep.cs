namespace DemoPos.Api.Models;

public class BundleStep
{
    public int Id { get; set; }
    public int ProductBundleId { get; set; }
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int MinQuantity { get; set; } = 1;
    public int MaxQuantity { get; set; } = 1;
    public bool IsOptional { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ProductBundle ProductBundle { get; set; } = null!;
    public ICollection<BundleStepProduct> StepProducts { get; set; } = new List<BundleStepProduct>();
}
