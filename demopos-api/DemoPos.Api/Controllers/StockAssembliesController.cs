using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Assembly;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/stock-assemblies")]
[Authorize]
public class StockAssembliesController(IAssemblyService assembly) : AppControllerBase
{
    // GET /api/stock-assemblies?page=1&pageSize=15&dateFrom=&dateTo=&type=&productId=&triggeredBy=
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? type = null,
        [FromQuery] int? productId = null,
        [FromQuery] string? triggeredBy = null,
        CancellationToken ct = default)
    {
        if (!HasPermission("assembly_view")) return Forbid();

        var (items, totalCount) = await assembly.GetAssembliesAsync(
            page, pageSize, dateFrom, dateTo, type, productId, triggeredBy, ct);

        return Ok(new { success = true, data = new { items, totalCount, page, pageSize } });
    }

    // GET /api/stock-assemblies/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (!HasPermission("assembly_view")) return Forbid();

        var result = await assembly.GetAssemblyByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Assembly record not found." });

        return Ok(new { success = true, data = result });
    }

    // POST /api/stock-assemblies
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateStockAssemblyRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("assembly_create")) return Forbid();

        int? userId = CurrentUserId > 0 ? CurrentUserId : (int?)null;

        var response = await assembly.CreateAssemblyAsync(request, userId, ct);

        // 201 Created; include warnings array (empty if no stock issues)
        return StatusCode(201, new
        {
            success = true,
            data = response.Assembly,
            warnings = response.Warnings
        });
    }

    // DELETE /api/stock-assemblies/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("assembly_delete")) return Forbid();

        try
        {
            var warnings = await assembly.DeleteAssemblyAsync(id, ct);
            return Ok(new { success = true, data = new { id }, warnings });
        }
        catch (KeyNotFoundException e)
        {
            return NotFound(new { success = false, message = e.Message });
        }
    }
}
