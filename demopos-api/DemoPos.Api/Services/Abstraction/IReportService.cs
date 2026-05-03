using DemoPos.Api.DTOs.Reports;

namespace DemoPos.Api.Services.Abstraction;

public interface IReportService
{
    Task<SaleReportDto> GetSaleReportAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken ct = default);

    Task<SaleSummaryReportDto> GetSaleSummaryAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken ct = default);

    Task<List<InventoryReportItemDto>> GetInventoryReportAsync(
        CancellationToken ct = default);

    Task<PurchaseReportDto> GetPurchaseReportAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken ct = default);

    Task<ProfitLossReportDto> GetProfitLossAsync(
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct = default);
}
