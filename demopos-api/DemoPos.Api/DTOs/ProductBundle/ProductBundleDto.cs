namespace DemoPos.Api.DTOs.ProductBundle;

public class ProductBundleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int MinItems { get; set; }
    public int MaxItems { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }

    // Multi-step bundle support
    public bool HasSteps { get; set; }
    public List<BundleStepDto> Steps { get; set; } = [];
}
