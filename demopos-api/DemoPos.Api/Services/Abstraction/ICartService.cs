using DemoPos.Api.DTOs.Cart;

namespace DemoPos.Api.Services.Abstraction;

public interface ICartService
{
    /// <summary>Clears all cart items for the user, then returns the empty cart.</summary>
    Task<List<CartItemDto>> ClearAsync(int userId, CancellationToken ct = default);

    /// <summary>Returns all cart items for the user, ordered by created_at asc.</summary>
    Task<List<CartItemDto>> GetAsync(int userId, CancellationToken ct = default);

    /// <summary>
    /// Adds product to cart (or increments if already present).
    /// Throws ArgumentException if product is not active or out of stock.
    /// Throws InvalidOperationException if quantity would exceed product stock.
    /// Returns updated full cart.
    /// </summary>
    Task<List<CartItemDto>> AddAsync(int userId, int productId, CancellationToken ct = default);

    /// <summary>
    /// Increments cart item quantity by 1.
    /// Throws InvalidOperationException if already at stock limit.
    /// Returns updated full cart.
    /// </summary>
    Task<List<CartItemDto>> IncrementAsync(int userId, int cartItemId, CancellationToken ct = default);

    /// <summary>
    /// Decrements cart item quantity by 1.
    /// If quantity reaches 0, the item is removed.
    /// Returns updated full cart.
    /// </summary>
    Task<List<CartItemDto>> DecrementAsync(int userId, int cartItemId, CancellationToken ct = default);

    /// <summary>Removes a single cart item. Throws KeyNotFoundException if not found or not owned by user.</summary>
    Task<List<CartItemDto>> RemoveAsync(int userId, int cartItemId, CancellationToken ct = default);

    /// <summary>
    /// Adds a bundle to the cart as one header row + N sub-item rows in a single transaction.
    /// Validates: bundle is active; product selection quantities are within MinItems..MaxItems;
    /// each selected product is POS-eligible (status=1, quantity&gt;=1).
    /// Throws ArgumentException / InvalidOperationException on validation failure.
    /// Returns updated full cart.
    /// </summary>
    Task<List<CartItemDto>> AddBundleAsync(int userId, AddBundleRequest request, CancellationToken ct = default);

    /// <summary>
    /// Removes a bundle header cart row and all its sub-item rows atomically.
    /// Throws KeyNotFoundException if the header row is not found or not owned by user.
    /// Returns updated full cart.
    /// </summary>
    Task<List<CartItemDto>> RemoveBundleAsync(int userId, int bundleHeaderCartItemId, CancellationToken ct = default);
}
