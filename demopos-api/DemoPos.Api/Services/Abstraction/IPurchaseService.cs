using DemoPos.Api.DTOs.Purchases;

namespace DemoPos.Api.Services.Abstraction;

public interface IPurchaseService
{
    Task<(IEnumerable<PurchaseSummaryDto> Items, int TotalCount)> GetAllAsync(
        string? search,
        int? supplierId,
        DateTime? dateFrom,
        DateTime? dateTo,
        int page,
        int pageSize,
        CancellationToken ct = default);
    Task<PurchaseDetailDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<PurchaseCreateResult> CreateOrUpdateAsync(
        CreateOrUpdatePurchaseRequest request,
        int? userId,
        CancellationToken ct = default);

    Task DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>
    /// Records a payment against an outstanding purchase due balance.
    /// Updates AmountPaid and AmountDue on the purchase, and inserts a PurchaseTransaction row.
    /// </summary>
    Task CollectPurchaseDueAsync(
        int purchaseId,
        PurchasePaymentRequest request,
        int? userId,
        CancellationToken ct = default);
}

/// <summary>
/// Return value from CreateOrUpdateAsync, including any auto-assembly results.
/// </summary>
public class PurchaseCreateResult
{
    public PurchaseDetailDto Purchase { get; set; } = null!;
    /// <summary>Auto-assemblies triggered by this purchase (empty on updates or if no products have templates).</summary>
    public List<AutoAssemblyInfo> AutoAssemblies { get; set; } = new();
    public List<string> AssemblyWarnings { get; set; } = new();
}

public class AutoAssemblyInfo
{
    public string TemplateName { get; set; } = string.Empty;
    public string OutputProduct { get; set; } = string.Empty;
    public decimal OutputQuantity { get; set; }
}
