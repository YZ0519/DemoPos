namespace DemoPos.Api.DTOs.ProductBundle;

public class BundleStepProductDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string? ProductImage { get; set; }
    public int StockQuantity { get; set; }
    public decimal Price { get; set; }
    public int SortOrder { get; set; }
}
