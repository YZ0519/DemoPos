using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Combo;
using DemoPos.Api.DTOs.Products;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/products")]
[Authorize]
public class ProductsController(IProductService products, AppDbContext db) : AppControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("product_view")) return Forbid();

        var result = await products.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// POS product browser — paginated, active + stocked products only (status=1, quantity>=1).
    /// Supports optional name/SKU filter via ?q=. Designed for infinite scroll — returns
    /// { items: ProductDto[], hasMore: bool } so the frontend knows when to stop fetching.
    /// No permission gate: any authenticated user can reach the POS terminal.
    /// Declared before the {id:int} route to prevent routing conflicts.
    /// </summary>
    [HttpGet("pos")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPosProducts(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 96,
        CancellationToken ct = default)
    {
        var (items, hasMore) = await products.GetPosProductsAsync(q, page, pageSize, ct);
        return Ok(new { success = true, data = new { items, hasMore } });
    }

    /// <summary>
    /// POS search — no permission gate. Returns only active + stocked products.
    /// Declared before {id:int} to avoid routing conflicts.
    /// </summary>
    [HttpGet("search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(new { success = true, data = Array.Empty<ProductDto>() });

        var result = await products.SearchAsync(q, ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Purchase form product search — paginated, no status/quantity filter.
    /// Accessible to purchase_create or purchase_update roles (not product_view).
    /// Declared before {id:int} to prevent routing conflicts.
    /// </summary>
    [HttpGet("purchase-search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PurchaseSearch(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        if (!HasPermission("purchase_create") && !HasPermission("purchase_update"))
            return Forbid();

        return await FormSearch(q, page, pageSize, ct);
    }

    /// <summary>
    /// Sale form product search — paginated, no status/quantity filter.
    /// Accessible to sale_create or sale_update roles.
    /// Declared before {id:int} to prevent routing conflicts.
    /// </summary>
    [HttpGet("sale-search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SaleSearch(
        [FromQuery] string? q,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        if (!HasPermission("sale_create") && !HasPermission("sale_update"))
            return Forbid();

        return await FormSearch(q, page, pageSize, ct);
    }

    private async Task<IActionResult> FormSearch(string? q, int page, int pageSize, CancellationToken ct)
    {
        var (items, hasMore) = await products.FormProductSearchAsync(q, page, pageSize, ct);
        return Ok(new { success = true, data = new { items, hasMore } });
    }

    /// <summary>
    /// Assembly form product lookup — returns all products with stock and purchase price.
    /// Gated on assembly_view OR assembly_create so users who only have assembly
    /// permissions (not product_view) can populate ingredient dropdowns.
    /// Declared before {id:int} to prevent routing conflicts.
    /// </summary>
    [HttpGet("assembly-lookup")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AssemblyLookup(CancellationToken ct)
    {
        if (!HasPermission("assembly_view") && !HasPermission("assembly_create"))
            return Forbid();

        var result = await products.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Bulk-update PosEnabled for one or more products.
    /// Used by both the inline row toggle (single id) and the bulk-select toolbar.
    /// Declared before [HttpPost] to avoid routing conflicts.
    /// </summary>
    [HttpPatch("pos-enabled")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> BulkSetPosEnabled(
        [FromBody] BulkSetPosEnabledRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();
        if (request.Ids == null || request.Ids.Count == 0)
            return BadRequest(new { success = false, message = "At least one product ID is required" });

        var count = await products.BulkSetPosEnabledAsync(request.Ids, request.PosEnabled, ct);
        return Ok(new { success = true, message = $"{count} product(s) updated" });
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromForm] CreateProductRequest request, CancellationToken ct)
    {
        if (!HasPermission("product_create")) return Forbid();

        var result = await products.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateProductRequest request, CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();

        var result = await products.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("product_delete")) return Forbid();

        await products.DeleteAsync(id, ct);
        return Ok(new { success = true, message = "Product deleted" });
    }

    // ── Combo Item Management ──────────────────────────────────────────────────

    /// <summary>
    /// Returns all component items for a combo product in sort order.
    /// The calling product must have ProductType="combo", though the endpoint
    /// does not enforce this — it simply returns an empty list for standard products.
    /// </summary>
    [HttpGet("{id:int}/combo-items")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetComboItems(int id, CancellationToken ct)
    {
        if (!HasPermission("product_view")) return Forbid();

        var productExists = await db.Products.AsNoTracking().AnyAsync(p => p.Id == id, ct);
        if (!productExists)
            return NotFound(new { success = false, message = $"Product {id} not found." });

        var items = await db.ComboItems
            .AsNoTracking()
            .Where(c => c.ComboProductId == id)
            .Include(c => c.ComponentProduct)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .ToListAsync(ct);

        var result = items.Select(c => new ComboItemDto
        {
            Id                   = c.Id,
            ComboProductId       = c.ComboProductId,
            ComponentProductId   = c.ComponentProductId,
            ComponentProductName = c.ComponentProduct?.Name ?? string.Empty,
            Quantity             = c.Quantity,
            SortOrder            = c.SortOrder,
        });

        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Adds a component product to a combo product.
    /// Returns 409 Conflict if the component already exists in this combo.
    /// </summary>
    [HttpPost("{id:int}/combo-items")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddComboItem(
        int id,
        [FromBody] CreateComboItemRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ModelState);

        // Validate combo product exists
        var comboProduct = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (comboProduct is null)
            return NotFound(new { success = false, message = $"Product {id} not found." });

        // Validate component product exists
        var componentProduct = await db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.ComponentProductId, ct);

        if (componentProduct is null)
            return NotFound(new { success = false, message = $"Component product {request.ComponentProductId} not found." });

        // Prevent self-referencing combos
        if (id == request.ComponentProductId)
            return BadRequest(new { success = false, message = "A product cannot be a component of itself." });

        // Enforce unique constraint (ComboProductId, ComponentProductId)
        var alreadyExists = await db.ComboItems
            .AsNoTracking()
            .AnyAsync(c => c.ComboProductId == id && c.ComponentProductId == request.ComponentProductId, ct);

        if (alreadyExists)
            return Conflict(new { success = false, message = $"Product '{componentProduct.Name}' is already a component of this combo." });

        var comboItem = new ComboItem
        {
            ComboProductId      = id,
            ComponentProductId  = request.ComponentProductId,
            Quantity            = request.Quantity,
            SortOrder           = request.SortOrder,
            CreatedAt           = DateTime.UtcNow,
            UpdatedAt           = DateTime.UtcNow,
        };

        db.ComboItems.Add(comboItem);
        await db.SaveChangesAsync(ct);

        var result = new ComboItemDto
        {
            Id                   = comboItem.Id,
            ComboProductId       = comboItem.ComboProductId,
            ComponentProductId   = comboItem.ComponentProductId,
            ComponentProductName = componentProduct.Name,
            Quantity             = comboItem.Quantity,
            SortOrder            = comboItem.SortOrder,
        };

        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    /// <summary>
    /// Removes a component product from a combo product.
    /// The route uses {componentId} which is the ComboItem.Id (not the component product id).
    /// </summary>
    [HttpDelete("{id:int}/combo-items/{componentId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveComboItem(int id, int componentId, CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();

        var comboItem = await db.ComboItems
            .FirstOrDefaultAsync(c => c.Id == componentId && c.ComboProductId == id, ct);

        if (comboItem is null)
            return NotFound(new { success = false, message = $"Combo item {componentId} not found on product {id}." });

        db.ComboItems.Remove(comboItem);
        await db.SaveChangesAsync(ct);

        return Ok(new { success = true, data = new { id = componentId } });
    }
}
