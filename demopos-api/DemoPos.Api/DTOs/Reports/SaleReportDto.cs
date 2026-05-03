namespace DemoPos.Api.DTOs.Reports;

public class SaleReportLineItemDto
{
    public string ProductName { get; set; } = string.Empty;
    public string? ProductSku { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public string? ModifierNote { get; set; }
}

public class SaleReportItemDto
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public decimal SubTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public decimal RoundingAdjustment { get; set; }
    public decimal RoundedTotal { get; set; }
    public decimal Paid { get; set; }
    public decimal Due { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<SaleReportLineItemDto> SaleItems { get; set; } = [];
}

public class SaleReportDto
{
    public List<SaleReportItemDto> Items { get; set; } = [];
    public decimal TotalSubTotal { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalPaid { get; set; }
    public decimal TotalDue { get; set; }
    public decimal GrandTotal { get; set; }
}
