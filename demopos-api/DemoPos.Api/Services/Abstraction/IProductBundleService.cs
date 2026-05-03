using DemoPos.Api.DTOs.ProductBundle;

namespace DemoPos.Api.Services.Abstraction;

public interface IProductBundleService
{
    /// <summary>
    /// Returns all bundles, optionally filtered to active-only.
    /// </summary>
    Task<IEnumerable<ProductBundleDto>> GetAllAsync(bool? activeOnly, CancellationToken ct = default);

    /// <summary>
    /// Creates a new product bundle definition.
    /// Throws <see cref="ArgumentException"/> if MaxItems &lt; MinItems.
    /// </summary>
    Task<ProductBundleDto> CreateAsync(CreateProductBundleRequest req, CancellationToken ct = default);

    /// <summary>
    /// Updates an existing bundle.
    /// Throws <see cref="KeyNotFoundException"/> if not found.
    /// Throws <see cref="ArgumentException"/> if MaxItems &lt; MinItems.
    /// </summary>
    Task<ProductBundleDto> UpdateAsync(int id, UpdateProductBundleRequest req, CancellationToken ct = default);

    /// <summary>
    /// Deletes a bundle definition.
    /// Throws <see cref="KeyNotFoundException"/> if not found.
    /// Throws <see cref="InvalidOperationException"/> if the bundle has been used in any sale
    /// (callers should deactivate it instead).
    /// </summary>
    Task DeleteAsync(int id, CancellationToken ct = default);
}
