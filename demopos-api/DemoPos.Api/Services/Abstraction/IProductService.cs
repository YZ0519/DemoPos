using DemoPos.Api.DTOs.Products;

namespace DemoPos.Api.Services.Abstraction;

public interface IProductService
{
    Task<List<ProductDto>> GetAllAsync(CancellationToken ct = default);
    Task<List<ProductDto>> SearchAsync(string term, CancellationToken ct = default);

    /// <summary>
    /// Returns a paginated page of POS-eligible products (status=1 AND quantity>=1).
    /// Optionally filtered by name/SKU via <paramref name="q"/>.
    /// </summary>
    Task<(List<ProductDto> Items, bool HasMore)> GetPosProductsAsync(
        string? q, int page, int pageSize, CancellationToken ct = default);
    /// <summary>
    /// Paginated product search for form dropdowns (Sales, Purchases).
    /// No status/quantity filter — any product is selectable regardless of stock.
    /// Returns items for the requested page and a hasMore flag for infinite scroll.
    /// </summary>
    Task<(List<ProductDto> Items, bool HasMore)> FormProductSearchAsync(
        string? q, int page, int pageSize, CancellationToken ct = default);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default);
    Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
    /// <summary>
    /// Sets PosEnabled to <paramref name="enabled"/> for every product in <paramref name="ids"/>.
    /// Returns the count of rows actually updated.
    /// </summary>
    Task<int> BulkSetPosEnabledAsync(List<int> ids, bool enabled, CancellationToken ct = default);
}
