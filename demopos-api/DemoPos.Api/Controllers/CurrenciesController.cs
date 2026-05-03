using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Currencies;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/currencies")]
[Authorize]
public class CurrenciesController(ICurrencyService currencies) : AppControllerBase
{
    // GET /api/currencies
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("currency_view")) return Forbid();

        var result = await currencies.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/currencies/active
    // No permission check — any authenticated user needs the default currency for display.
    [HttpGet("active")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        var result = await currencies.GetActiveAsync(ct);

        if (result is null)
            return NotFound(new { success = false, message = "No active currency configured." });

        return Ok(new
        {
            success = true,
            data = new
            {
                id = result.Id,
                name = result.Name,
                code = result.Code,
                symbol = result.Symbol,
                active = result.Active,
            }
        });
    }

    // POST /api/currencies
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateOrUpdateCurrencyRequest request, CancellationToken ct)
    {
        if (!HasPermission("currency_create")) return Forbid();

        try
        {
            var result = await currencies.CreateAsync(request, ct);
            return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // PUT /api/currencies/{id}
    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateOrUpdateCurrencyRequest request, CancellationToken ct)
    {
        if (!HasPermission("currency_update")) return Forbid();

        try
        {
            var result = await currencies.UpdateAsync(id, request, ct);
            return Ok(new { success = true, data = result });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // DELETE /api/currencies/{id}
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("currency_delete")) return Forbid();

        try
        {
            await currencies.DeleteAsync(id, ct);
            return Ok(new { success = true, data = new { id } });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    // PATCH /api/currencies/{id}/set-default
    [HttpPatch("{id:int}/set-default")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetDefault(int id, CancellationToken ct)
    {
        if (!HasPermission("currency_set_default")) return Forbid();

        await currencies.SetDefaultAsync(id, ct);
        return Ok(new { success = true, message = "Default currency updated." });
    }
}
