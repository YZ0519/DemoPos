using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Purchases;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/purchases")]
[Authorize]
public class PurchasesController(IPurchaseService purchases, IAuditService audit) : AppControllerBase
{
    // GET /api/purchases
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? supplierId,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        CancellationToken ct = default)
    {
        if (!HasPermission("purchase_view")) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 200);

        var (items, totalCount) = await purchases.GetAllAsync(search, supplierId, dateFrom, dateTo, page, pageSize, ct);

        return Ok(new
        {
            success = true,
            data = new { items, totalCount, page, pageSize }
        });
    }

    // GET /api/purchases/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (!HasPermission("purchase_view")) return Forbid();

        var result = await purchases.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Purchase not found." });

        return Ok(new { success = true, data = result });
    }

    // GET /api/purchases/{id}/products
    // Returns the same full purchase detail (items list included).
    [HttpGet("{id:int}/products")]
    public async Task<IActionResult> GetProducts(int id, CancellationToken ct)
    {
        if (!HasPermission("purchase_view")) return Forbid();

        var result = await purchases.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Purchase not found." });

        return Ok(new { success = true, data = result });
    }

    // DELETE /api/purchases/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("purchase_delete")) return Forbid();

        try
        {
            await purchases.DeleteAsync(id, ct);

            await audit.LogAsync(
                "DELETE", "Purchase", id.ToString(),
                $"Purchase #{id} deleted",
                CurrentUserId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

            return Ok(new { success = true, data = new { id } });
        }
        catch (KeyNotFoundException e)
        {
            return NotFound(new { success = false, message = e.Message });
        }
    }

    // POST /api/purchases/{id}/payment
    [HttpPost("{id:int}/payment")]
    public async Task<IActionResult> RecordPayment(
        int id,
        [FromBody] PurchasePaymentRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("purchase_update")) return Forbid();

        int? userId = CurrentUserId > 0 ? CurrentUserId : (int?)null;

        await purchases.CollectPurchaseDueAsync(id, request, userId, ct);
        return Ok(new { success = true });
    }

    // POST /api/purchases
    // Handles both create (PurchaseId == null) and edit (PurchaseId != null).
    // On create, auto-assembly results are included in the response (additive, no breaking change).
    [HttpPost]
    public async Task<IActionResult> CreateOrUpdate(
        [FromBody] CreateOrUpdatePurchaseRequest request,
        CancellationToken ct)
    {
        // Permission depends on whether this is a create or an edit
        var requiredPermission = request.PurchaseId.HasValue ? "purchase_update" : "purchase_create";
        if (!HasPermission(requiredPermission)) return Forbid();

        int? userId = CurrentUserId > 0 ? CurrentUserId : (int?)null;

        try
        {
            var result = await purchases.CreateOrUpdateAsync(request, userId, ct);

            var isCreate = !request.PurchaseId.HasValue;
            int statusCode = isCreate ? 201 : 200;

            if (isCreate)
            {
                await audit.LogAsync(
                    "CREATE", "Purchase", result.Purchase.Id.ToString(),
                    $"Purchase #{result.Purchase.Id} created",
                    CurrentUserId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);
            }

            return StatusCode(statusCode, new
            {
                success = true,
                data = result.Purchase,
                autoAssemblies = result.AutoAssemblies,
                assemblyWarnings = result.AssemblyWarnings
            });
        }
        catch (KeyNotFoundException e)
        {
            return NotFound(new { success = false, message = e.Message });
        }
        catch (InvalidOperationException e)
        {
            return BadRequest(new { success = false, message = e.Message });
        }
    }
}
