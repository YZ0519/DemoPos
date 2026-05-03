namespace DemoPos.Api.DTOs.Sales;

public class SaleDetailDto : SaleSummaryDto
{
    public string? UserName { get; set; }
    public List<SaleItemDto> Items { get; set; } = [];
    public List<SaleTransactionDto> Transactions { get; set; } = [];
}
