using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.RestaurantTable;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/tables")]
[Authorize]
public class TablesController(ITableService tableService) : AppControllerBase
{
    // GET /api/tables
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("table_view")) return Forbid();

        var result = await tableService.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/tables/active — any authenticated user (no permission required)
    [HttpGet("active")]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        var result = await tableService.GetActiveAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // POST /api/tables
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateTableRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("table_create")) return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        try
        {
            var result = await tableService.CreateAsync(request, ct);
            return StatusCode(201, new { success = true, data = result });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // PUT /api/tables/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateTableRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("table_update")) return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        try
        {
            var result = await tableService.UpdateAsync(id, request, ct);
            return Ok(new { success = true, data = result });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = $"Table {id} not found." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // DELETE /api/tables/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("table_delete")) return Forbid();

        try
        {
            await tableService.DeleteAsync(id, ct);
            return Ok(new { success = true, data = new { id } });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = $"Table {id} not found." });
        }
        catch (InvalidOperationException ex)
        {
            // Table is occupied or has historical sales — 409 Conflict
            return StatusCode(409, new { success = false, message = ex.Message });
        }
    }

    // PATCH /api/tables/{id}/status — any authenticated user
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> SetStatus(
        int id,
        [FromBody] SetTableStatusRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        try
        {
            await tableService.SetStatusAsync(id, request.Status, ct);
            return Ok(new { success = true, data = new { id, status = request.Status } });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = $"Table {id} not found." });
        }
    }
}

/// <summary>
/// Payload for PATCH /api/tables/{id}/status.
/// Kept here as a small inline DTO since it is only used by this endpoint.
/// </summary>
public class SetTableStatusRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    public string Status { get; set; } = string.Empty;
}
