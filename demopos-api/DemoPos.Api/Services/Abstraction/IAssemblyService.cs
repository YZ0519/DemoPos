using DemoPos.Api.DTOs.Assembly;

namespace DemoPos.Api.Services.Abstraction;

public interface IAssemblyService
{
    // ── Assembly Templates ─────────────────────────────────────────────────────

    Task<(IEnumerable<AssemblyTemplateSummaryDto> Items, int TotalCount)> GetTemplatesAsync(
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task<AssemblyTemplateDetailDto?> GetTemplateByIdAsync(int id, CancellationToken ct = default);

    Task<AssemblyTemplateDetailDto> CreateTemplateAsync(
        CreateAssemblyTemplateRequest request,
        CancellationToken ct = default);

    Task<AssemblyTemplateDetailDto> UpdateTemplateAsync(
        int id,
        UpdateAssemblyTemplateRequest request,
        CancellationToken ct = default);

    /// <summary>
    /// Deletes a template. Throws InvalidOperationException if the template has
    /// associated assembly records (soft constraint).
    /// </summary>
    Task DeleteTemplateAsync(int id, CancellationToken ct = default);

    // ── Stock Assemblies ───────────────────────────────────────────────────────

    Task<(IEnumerable<StockAssemblySummaryDto> Items, int TotalCount)> GetAssembliesAsync(
        int page,
        int pageSize,
        DateTime? dateFrom,
        DateTime? dateTo,
        string? assemblyType,
        int? outputProductId,
        string? triggeredBy,
        CancellationToken ct = default);

    Task<StockAssemblyDetailDto?> GetAssemblyByIdAsync(int id, CancellationToken ct = default);

    /// <summary>
    /// Executes a manual assembly run. Deducts ingredient stock, adds output stock,
    /// computes cost. Returns the created record plus any stock-insufficiency warnings.
    /// </summary>
    Task<CreateStockAssemblyResponse> CreateAssemblyAsync(
        CreateStockAssemblyRequest request,
        int? userId,
        CancellationToken ct = default);

    /// <summary>
    /// Deletes an assembly and fully reverses all stock changes.
    /// Returns any warnings (e.g. output stock going negative).
    /// </summary>
    Task<List<string>> DeleteAssemblyAsync(int id, CancellationToken ct = default);

    /// <summary>
    /// Called after a purchase is saved. Iterates purchase items; for each product
    /// with AutoAssemblyTemplateId set, executes the template scaled to the purchased
    /// quantity. Runs inside the caller's existing DB transaction.
    /// </summary>
    Task<List<AutoAssemblyResult>> TriggerAutoAssemblyForPurchaseAsync(
        int purchaseId,
        int? userId,
        CancellationToken ct = default);
}

/// <summary>
/// Result of a single auto-assembly triggered by a purchase line.
/// </summary>
public class AutoAssemblyResult
{
    public string TemplateName { get; set; } = string.Empty;
    public string OutputProduct { get; set; } = string.Empty;
    public decimal OutputQuantity { get; set; }
    public List<string> Warnings { get; set; } = new();
}
