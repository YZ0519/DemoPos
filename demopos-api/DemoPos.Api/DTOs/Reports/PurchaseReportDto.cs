namespace DemoPos.Api.DTOs.Reports;

public class PurchaseReportLineItemDto
{
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }   // PurchaseItem.PurchasePrice
    public decimal Total { get; set; }       // PurchasePrice * Quantity
}

public class PurchaseReportItemDto
{
    public int Id { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public decimal SubTotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal Shipping { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal RoundedTotal { get; set; }
    public decimal RoundingAdjustment { get; set; }
    public DateTime Date { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<PurchaseReportLineItemDto> PurchaseItems { get; set; } = [];
}

public class PurchaseReportDto
{
    public List<PurchaseReportItemDto> Items { get; set; } = [];
    public decimal TotalSubTotal { get; set; }
    public decimal TotalTax { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalShipping { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal TotalRoundingAdjustment { get; set; }
    public int Count { get; set; }
}
