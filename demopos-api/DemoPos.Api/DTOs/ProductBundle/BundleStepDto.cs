namespace DemoPos.Api.DTOs.ProductBundle;

public class BundleStepDto
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public int MinQuantity { get; set; }
    public int MaxQuantity { get; set; }
    public bool IsOptional { get; set; }
    public List<BundleStepProductDto> Products { get; set; } = [];
}
