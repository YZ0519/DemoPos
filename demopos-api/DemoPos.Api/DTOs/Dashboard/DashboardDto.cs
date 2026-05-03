namespace DemoPos.Api.DTOs.Dashboard;

public class DashboardDto
{
    public decimal SaleSubTotal { get; set; }
    public decimal SaleDiscount { get; set; }
    public decimal SaleTotal { get; set; }
    public decimal SaleDue { get; set; }

    public int TotalCustomers { get; set; }
    public int TotalProducts { get; set; }
    public int TotalOrders { get; set; }
    public int TotalSaleItems { get; set; }

    public List<DailyChartPoint> DailyChart { get; set; } = [];
    public List<MonthlyChartPoint> MonthlyChart { get; set; } = [];
}

public record DailyChartPoint(string Date, decimal Total);

public record MonthlyChartPoint(int Month, string Label, decimal Total);
