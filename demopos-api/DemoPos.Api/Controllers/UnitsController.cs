using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Units;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/units")]
[Authorize]
public class UnitsController(IUnitService units) : AppControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("unit_view")) return Forbid();

        var result = await units.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateUnitRequest request, CancellationToken ct)
    {
        if (!HasPermission("unit_create")) return Forbid();

        var result = await units.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUnitRequest request, CancellationToken ct)
    {
        if (!HasPermission("unit_update")) return Forbid();

        var result = await units.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("unit_delete")) return Forbid();

        await units.DeleteAsync(id, ct);
        return Ok(new { success = true, message = "Unit deleted" });
    }
}
