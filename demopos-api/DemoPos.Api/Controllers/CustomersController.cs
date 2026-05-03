using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Customers;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/customers")]
[Authorize]
public class CustomersController(ICustomerService customers, ISaleService sales) : AppControllerBase
{
    // GET /api/customers?page=1&pageSize=15&search=...
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        if (!HasPermission("customer_view")) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 200);

        var (items, totalCount) = await customers.GetPagedAsync(page, pageSize, search, ct);
        int totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling((double)totalCount / pageSize);

        return Ok(new
        {
            success = true,
            data = new { items, totalCount, page, pageSize, totalPages }
        });
    }

    // GET /api/customers/all  — full unfiltered list for dropdowns
    [HttpGet("all")]
    public async Task<IActionResult> GetAllList(CancellationToken ct)
    {
        if (!HasPermission("customer_view")) return Forbid();

        var result = await customers.GetAllListAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/customers/search?q=text&limit=20  — lightweight POS autocomplete
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        if (!HasPermission("customer_view")) return Forbid();

        limit = Math.Clamp(limit, 1, 100);

        var result = await customers.SearchAsync(q, limit, ct);
        return Ok(new { success = true, data = result });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (!HasPermission("customer_view")) return Forbid();

        var result = await customers.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Customer not found." });

        return Ok(new { success = true, data = result });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request, CancellationToken ct)
    {
        if (!HasPermission("customer_create")) return Forbid();

        var result = await customers.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomerRequest request, CancellationToken ct)
    {
        if (!HasPermission("customer_update")) return Forbid();

        var result = await customers.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("customer_delete")) return Forbid();

        await customers.DeleteAsync(id, ct);
        return Ok(new { success = true, data = new { id } });
    }

    [HttpGet("{id:int}/sales")]
    public async Task<IActionResult> GetSales(int id, CancellationToken ct)
    {
        if (!HasPermission("customer_sales")) return Forbid();

        var result = await sales.GetByCustomerAsync(id, ct);
        return Ok(new { success = true, data = result });
    }
}
