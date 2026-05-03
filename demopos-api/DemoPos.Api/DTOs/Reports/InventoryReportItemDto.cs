namespace DemoPos.Api.DTOs.Reports;

public class InventoryReportItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal DiscountedPrice { get; set; }
    public bool HasDiscount { get; set; }
    public int Quantity { get; set; }
    public string UnitShortName { get; set; } = string.Empty;
}
