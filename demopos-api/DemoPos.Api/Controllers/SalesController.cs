using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Sales;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/sales")]
[Authorize]
public class SalesController(ISaleService sales, IAuditService audit) : AppControllerBase
{
    // POST /api/sales
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateSaleRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        int userId = CurrentUserId;
        var result = await sales.CreateAsync(request, userId, ct);

        await audit.LogAsync(
            "CREATE", "Sale", result.Id.ToString(),
            $"POS checkout sale #{result.Id}",
            userId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    // POST /api/sales/direct
    [HttpPost("direct")]
    public async Task<IActionResult> DirectCreate(
        [FromBody] DirectCreateSaleRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        int userId = CurrentUserId;
        var result = await sales.DirectCreateAsync(request, userId, ct);

        await audit.LogAsync(
            "CREATE", "Sale", result.Id.ToString(),
            $"Direct sale #{result.Id}",
            userId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    // GET /api/sales
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] int? status,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 15,
        CancellationToken ct = default)
    {
        if (!HasPermission("sale_view")) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 200);

        var (items, totalCount) = await sales.GetAllAsync(search, status, dateFrom, dateTo, page, pageSize, ct);

        return Ok(new
        {
            success = true,
            data = new { items, totalCount, page, pageSize }
        });
    }

    // GET /api/sales/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_view")) return Forbid();

        var result = await sales.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Sale not found." });

        return Ok(new { success = true, data = result });
    }

    // GET /api/sales/{id}/invoice
    [HttpGet("{id:int}/invoice")]
    public async Task<IActionResult> GetInvoice(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_view")) return Forbid();

        var result = await sales.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Sale not found." });

        return Ok(new { success = true, data = result });
    }

    // GET /api/sales/{id}/pos-invoice
    [HttpGet("{id:int}/pos-invoice")]
    public async Task<IActionResult> GetPosInvoice(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_view")) return Forbid();

        var result = await sales.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Sale not found." });

        return Ok(new { success = true, data = result });
    }

    // GET /api/sales/{id}/transactions
    [HttpGet("{id:int}/transactions")]
    public async Task<IActionResult> GetTransactions(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_view")) return Forbid();

        var result = await sales.GetByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Sale not found." });

        return Ok(new { success = true, data = result.Transactions });
    }

    // POST /api/sales/{id}/collection
    [HttpPost("{id:int}/collection")]
    public async Task<IActionResult> CollectDue(
        int id,
        [FromBody] DueCollectionRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_update")) return Forbid();

        int? userId = CurrentUserId > 0 ? CurrentUserId : null;

        var result = await sales.CollectDueAsync(id, request, userId, ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/sales/{id}/collection/{txnId}
    [HttpGet("{id:int}/collection/{txnId:int}")]
    public async Task<IActionResult> GetCollectionReceipt(int id, int txnId, CancellationToken ct)
    {
        if (!HasPermission("sale_view")) return Forbid();

        var result = await sales.GetCollectionReceiptAsync(id, txnId, ct);
        if (result is null) return NotFound(new { success = false, message = "Transaction not found for this sale." });

        return Ok(new { success = true, data = result });
    }

    // PATCH /api/sales/{id}/status
    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(
        int id,
        [FromBody] UpdateSaleStatusRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_update")) return Forbid();

        await sales.UpdateStatusAsync(id, request.Status, ct);
        return Ok(new { success = true, data = new { id, status = request.Status } });
    }

    // PUT /api/sales/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateSaleRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_update")) return Forbid();

        var result = await sales.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    // POST /api/sales/{id}/return
    [HttpPost("{id:int}/return")]
    public async Task<IActionResult> Return(
        int id,
        [FromBody] ReturnSaleRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_update")) return Forbid();

        await sales.ReturnSaleAsync(id, request, ct);

        await audit.LogAsync(
            "RETURN", "Sale", id.ToString(),
            $"Sale #{id} returned",
            CurrentUserId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return Ok(new { success = true, message = "Sale returned successfully" });
    }

    // DELETE /api/sales/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_delete")) return Forbid();

        await sales.DeleteAsync(id, ct);

        await audit.LogAsync(
            "DELETE", "Sale", id.ToString(),
            $"Sale #{id} deleted",
            CurrentUserId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return Ok(new { success = true, data = new { id } });
    }

    // ── Restaurant R2/R3/R6 — Open Orders & Kitchen ────────────────────────────

    // POST /api/sales/open
    [HttpPost("open")]
    public async Task<IActionResult> CreateOpenOrder(
        [FromBody] CreateOpenOrderRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        int userId = CurrentUserId;
        var result = await sales.CreateOpenOrderAsync(request, userId, ct);

        var tableInfo = request.TableId.HasValue
            ? $"for table {request.TableId.Value}"
            : "(takeaway)";

        await audit.LogAsync(
            "CREATE", "Sale", result.Id.ToString(),
            $"Open order #{result.Id} created {tableInfo}",
            userId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    // GET /api/sales/open
    [HttpGet("open")]
    public async Task<IActionResult> GetOpenOrders(CancellationToken ct)
    {
        if (!HasPermission("sale_view")) return Forbid();

        var result = await sales.GetOpenOrdersAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/sales/open/table/{tableId}
    [HttpGet("open/table/{tableId:int}")]
    public async Task<IActionResult> GetOpenOrderForTable(int tableId, CancellationToken ct)
    {
        if (!HasPermission("sale_view")) return Forbid();

        var result = await sales.GetOpenOrderForTableAsync(tableId, ct);
        if (result is null)
            return NotFound(new { success = false, message = "No open order found for this table." });

        return Ok(new { success = true, data = result });
    }

    // POST /api/sales/{id}/items
    [HttpPost("{id:int}/items")]
    public async Task<IActionResult> AddItem(
        int id,
        [FromBody] AddSaleItemRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        var result = await sales.AddItemToSaleAsync(id, request, CurrentUserId, ct);
        return Ok(new { success = true, data = result });
    }

    // POST /api/sales/{id}/items/batch
    [HttpPost("{id:int}/items/batch")]
    public async Task<IActionResult> AddItemsBatch(
        int id,
        [FromBody] List<AddSaleItemRequest> items,
        CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        var result = await sales.AddItemsBatchToSaleAsync(id, items, CurrentUserId, ct);
        return Ok(new { success = true, data = result });
    }

    // PUT /api/sales/{id}/items/{itemId}
    [HttpPut("{id:int}/items/{itemId:int}")]
    public async Task<IActionResult> UpdateItem(
        int id,
        int itemId,
        [FromBody] PatchSaleItemRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_update")) return Forbid();

        var result = await sales.UpdateSaleItemAsync(id, itemId, request, CurrentUserId, ct);
        return Ok(new { success = true, data = result });
    }

    // DELETE /api/sales/{id}/items/{itemId}  — voids the item (soft delete)
    [HttpDelete("{id:int}/items/{itemId:int}")]
    public async Task<IActionResult> VoidItem(int id, int itemId, CancellationToken ct)
    {
        if (!HasPermission("sale_update")) return Forbid();

        var (sale, voidTicket) = await sales.VoidSaleItemAsync(id, itemId, CurrentUserId, ct);

        return Ok(new
        {
            success   = true,
            data      = sale,
            voidTicket = voidTicket  // null when item was not yet kitchen-sent
        });
    }

    // POST /api/sales/{id}/send-kitchen
    [HttpPost("{id:int}/send-kitchen")]
    public async Task<IActionResult> SendToKitchen(int id, CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        var ticket = await sales.SendToKitchenAsync(id, ct);
        return Ok(new { success = true, data = ticket });
    }

    // POST /api/sales/{id}/settle
    [HttpPost("{id:int}/settle")]
    public async Task<IActionResult> SettleOrder(
        int id,
        [FromBody] SettleOrderRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_create")) return Forbid();

        int userId = CurrentUserId;
        var result = await sales.SettleOrderAsync(id, request, userId, Response, ct);

        await audit.LogAsync(
            "SETTLE", "Sale", result.Id.ToString(),
            $"Open order #{result.Id} settled",
            userId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return Ok(new { success = true, data = result });
    }

    // POST /api/sales/{id}/merge
    [HttpPost("{id:int}/merge")]
    public async Task<IActionResult> MergeOrders(
        int id,
        [FromBody] MergeOrderRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("sale_update")) return Forbid();

        int userId = CurrentUserId;
        var result = await sales.MergeAsync(id, request, userId, ct);

        await audit.LogAsync(
            "MERGE", "Sale", id.ToString(),
            $"Sale #{id} absorbed orders: {string.Join(", ", request.AbsorbSaleIds)}",
            userId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return Ok(new { success = true, data = result });
    }
}
