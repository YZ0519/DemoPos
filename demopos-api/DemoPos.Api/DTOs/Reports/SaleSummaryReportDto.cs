namespace DemoPos.Api.DTOs.Reports;

public class SaleSummaryReportDto
{
    public decimal SubTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Paid { get; set; }
    public decimal Due { get; set; }
    public decimal Total { get; set; }
    public int OrderCount { get; set; }
}
