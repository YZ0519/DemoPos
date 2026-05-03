using DemoPos.Api.DTOs.Sales;
using Microsoft.AspNetCore.Http;

namespace DemoPos.Api.Services.Abstraction;

public interface ISaleService
{
    Task ReturnSaleAsync(int saleId, ReturnSaleRequest request, CancellationToken ct = default);

    Task<(IEnumerable<SaleSummaryDto> Items, int TotalCount)> GetAllAsync(
        string? search,
        int? status,
        DateTime? dateFrom,
        DateTime? dateTo,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<SaleDetailDto?> GetByIdAsync(int id, CancellationToken ct = default);

    Task<SaleTransactionDto> CollectDueAsync(
        int saleId,
        DueCollectionRequest request,
        int? userId,
        CancellationToken ct = default);

    Task<SaleDetailDto?> GetCollectionReceiptAsync(int saleId, int transactionId, CancellationToken ct = default);

    Task<bool> UpdateStatusAsync(int id, int status, CancellationToken ct = default);

    Task<bool> DeleteAsync(int id, CancellationToken ct = default);

    Task<IEnumerable<SaleSummaryDto>> GetByCustomerAsync(int customerId, CancellationToken ct = default);

    Task<SaleDetailDto> CreateAsync(
        CreateSaleRequest request,
        int userId,
        CancellationToken ct = default);

    Task<SaleDetailDto> UpdateAsync(int id, UpdateSaleRequest request, CancellationToken ct = default);

    Task<SaleDetailDto> DirectCreateAsync(
        DirectCreateSaleRequest request,
        int userId,
        CancellationToken ct = default);

    // ── Restaurant R2/R3/R6 — Open Orders & Kitchen ───────────────────────────

    Task<SaleDetailDto> CreateOpenOrderAsync(
        CreateOpenOrderRequest req,
        int userId,
        CancellationToken ct = default);

    Task<IEnumerable<SaleDetailDto>> GetOpenOrdersAsync(CancellationToken ct = default);

    Task<SaleDetailDto?> GetOpenOrderForTableAsync(int tableId, CancellationToken ct = default);

    Task<SaleDetailDto> AddItemToSaleAsync(
        int saleId,
        AddSaleItemRequest req,
        int userId,
        CancellationToken ct = default);

    Task<SaleDetailDto> AddItemsBatchToSaleAsync(
        int saleId,
        List<AddSaleItemRequest> items,
        int userId,
        CancellationToken ct = default);

    Task<SaleDetailDto> UpdateSaleItemAsync(
        int saleId,
        int itemId,
        PatchSaleItemRequest req,
        int userId,
        CancellationToken ct = default);

    Task<(SaleDetailDto Sale, KitchenTicketResponse? VoidTicket)> VoidSaleItemAsync(
        int saleId,
        int itemId,
        int userId,
        CancellationToken ct = default);

    Task<KitchenTicketResponse> SendToKitchenAsync(int saleId, CancellationToken ct = default);

    Task<SaleDetailDto> SettleOrderAsync(
        int saleId,
        SettleOrderRequest req,
        int userId,
        HttpResponse httpResponse,
        CancellationToken ct = default);

    Task<SaleDetailDto> MergeAsync(
        int primarySaleId,
        MergeOrderRequest request,
        int userId,
        CancellationToken ct = default);
}
