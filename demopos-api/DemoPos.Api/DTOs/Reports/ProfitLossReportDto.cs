namespace DemoPos.Api.DTOs.Reports;

public class ProfitLossReportDto
{
    /// <summary>Sum of SaleItem.Price * Quantity (selling price at time of sale).</summary>
    public decimal TotalRevenue { get; set; }

    /// <summary>Sum of SaleItem.PurchasePrice * Quantity (cost of goods sold).</summary>
    public decimal TotalCogs { get; set; }

    /// <summary>TotalRevenue - TotalCogs.</summary>
    public decimal GrossProfit { get; set; }

    /// <summary>GrossProfit / TotalRevenue * 100, or 0 when revenue is zero.</summary>
    public decimal GrossMarginPercent { get; set; }

    /// <summary>Sum of all sale-level discounts within the period.</summary>
    public decimal TotalDiscount { get; set; }

    /// <summary>Per-sale breakdown rows.</summary>
    public List<ProfitLossItemDto> Items { get; set; } = [];
}

public class ProfitLossItemDto
{
    public int SaleId { get; set; }
    public DateTime SaleDate { get; set; }
    public decimal Revenue { get; set; }
    public decimal Cogs { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal MarginPercent { get; set; }
}
