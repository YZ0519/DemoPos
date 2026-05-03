using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Cart;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/cart")]
[Authorize]
public class CartController(ICartService cart) : AppControllerBase
{
    private int UserId => CurrentUserId;

    // DELETE /api/cart
    // Clears entire cart for current user. Called on POS page mount.
    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();
        var result = await cart.ClearAsync(UserId, ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/cart
    // Returns all cart items for current user.
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();
        var result = await cart.GetAsync(UserId, ct);
        return Ok(new { success = true, data = result });
    }

    // POST /api/cart
    // Add product to cart (or increment if already present).
    [HttpPost]
    public async Task<IActionResult> Add([FromBody] AddToCartRequest request, CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();
        var result = await cart.AddAsync(UserId, request.ProductId, ct);
        return Ok(new { success = true, data = result });
    }

    // PATCH /api/cart/{id}/increment
    // Increment cart item quantity by 1.
    [HttpPatch("{id:int}/increment")]
    public async Task<IActionResult> Increment(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();
        var result = await cart.IncrementAsync(UserId, id, ct);
        return Ok(new { success = true, data = result });
    }

    // PATCH /api/cart/{id}/decrement
    // Decrement cart item quantity by 1. Removes item if quantity reaches 0.
    [HttpPatch("{id:int}/decrement")]
    public async Task<IActionResult> Decrement(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();
        var result = await cart.DecrementAsync(UserId, id, ct);
        return Ok(new { success = true, data = result });
    }

    // DELETE /api/cart/{id}
    // Remove a single item from the cart.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Remove(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();
        var result = await cart.RemoveAsync(UserId, id, ct);
        return Ok(new { success = true, data = result });
    }

    // POST /api/cart/bundle
    // Adds a bundle to the cart (one header + N sub-item rows) atomically.
    // Body: { bundleId: int, selectedProducts: [{ productId: int, quantity: int }] }
    [HttpPost("bundle")]
    public async Task<IActionResult> AddBundle([FromBody] AddBundleRequest request, CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        var result = await cart.AddBundleAsync(UserId, request, ct);
        return Ok(new { success = true, data = result });
    }

    // DELETE /api/cart/bundle/{headerId}
    // Removes a bundle header row and all its sub-item rows from the cart.
    [HttpDelete("bundle/{headerId:int}")]
    public async Task<IActionResult> RemoveBundle(int headerId, CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();
        var result = await cart.RemoveBundleAsync(UserId, headerId, ct);
        return Ok(new { success = true, data = result });
    }
}
