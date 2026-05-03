using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Voucher;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/vouchers")]
[Authorize]
public class VouchersController(IVoucherService voucherService) : AppControllerBase
{
    // GET /api/vouchers
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("voucher_view")) return Forbid();

        var result = await voucherService.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/vouchers/active
    [HttpGet("active")]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        var result = await voucherService.GetActiveAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/vouchers/validate?code={c}
    [HttpGet("validate")]
    public async Task<IActionResult> Validate([FromQuery] string code, CancellationToken ct)
    {
        // Never 404 — invalid codes return IsValid=false in the result body
        var result = await voucherService.ValidateAsync(code, ct);
        return Ok(new { success = true, data = result });
    }

    // POST /api/vouchers
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateVoucherRequest request, CancellationToken ct)
    {
        if (!HasPermission("voucher_create")) return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        try
        {
            var result = await voucherService.CreateAsync(request, ct);
            return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
        }
        catch (ArgumentException ex)
        {
            // Service-layer business rule violations (invalid discountType, appliesTo, empty items)
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, message = ex.Message });
        }
    }

    // PUT /api/vouchers/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] CreateVoucherRequest request, CancellationToken ct)
    {
        if (!HasPermission("voucher_update")) return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        try
        {
            var result = await voucherService.UpdateAsync(id, request, ct);
            return Ok(new { success = true, data = result });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = $"Voucher {id} not found." });
        }
        catch (ArgumentException ex)
        {
            // Service-layer business rule violations (invalid discountType, appliesTo, empty items)
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, message = ex.Message });
        }
    }

    // DELETE /api/vouchers/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("voucher_delete")) return Forbid();

        try
        {
            await voucherService.DeleteAsync(id, ct);
            return Ok(new { success = true, data = new { id } });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = $"Voucher {id} not found." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { success = false, message = ex.Message });
        }
    }
}
