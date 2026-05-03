using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Suppliers;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/suppliers")]
[Authorize]
public class SuppliersController(ISupplierService suppliers) : AppControllerBase
{
    // GET /api/suppliers?page=1&pageSize=15&search=...
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (!HasPermission("supplier_view")) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 200);

        var (items, totalCount) = await suppliers.GetPagedAsync(page, pageSize, search, ct);
        int totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling((double)totalCount / pageSize);

        return Ok(new
        {
            success = true,
            data = new { items, totalCount, page, pageSize, totalPages }
        });
    }

    // GET /api/suppliers/all  — full unfiltered list for dropdowns
    [HttpGet("all")]
    public async Task<IActionResult> GetAllList(CancellationToken ct)
    {
        if (!HasPermission("supplier_view")) return Forbid();

        var result = await suppliers.GetAllListAsync(ct);
        return Ok(new { success = true, data = result });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (!HasPermission("supplier_view")) return Forbid();

        var result = await suppliers.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Supplier not found." });

        return Ok(new { success = true, data = result });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSupplierRequest request, CancellationToken ct)
    {
        if (!HasPermission("supplier_create")) return Forbid();

        var result = await suppliers.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSupplierRequest request, CancellationToken ct)
    {
        if (!HasPermission("supplier_update")) return Forbid();

        var result = await suppliers.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("supplier_delete")) return Forbid();

        await suppliers.DeleteAsync(id, ct);
        return Ok(new { success = true, data = new { id } });
    }
}
