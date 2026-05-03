using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/reports")]
[Authorize]
public class ReportsController(IReportService reportService) : AppControllerBase
{
    // GET /api/reports/sales?startDate=&endDate=
    [HttpGet("sales")]
    public async Task<IActionResult> GetSalesReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken ct = default)
    {
        if (!HasPermission("reports_sales")) return Forbid();

        if (startDate.HasValue && endDate.HasValue && startDate > endDate)
            return BadRequest(new { success = false, message = "startDate must be before endDate." });

        var utcNow        = DateTime.UtcNow;
        var resolvedEnd   = endDate   ?? utcNow;
        var resolvedStart = startDate ?? utcNow.AddDays(-29);

        var result = await reportService.GetSaleReportAsync(resolvedStart, resolvedEnd, ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/reports/summary?startDate=&endDate=
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken ct = default)
    {
        if (!HasPermission("reports_summary")) return Forbid();

        if (startDate.HasValue && endDate.HasValue && startDate > endDate)
            return BadRequest(new { success = false, message = "startDate must be before endDate." });

        var utcNow        = DateTime.UtcNow;
        var resolvedEnd   = endDate   ?? utcNow;
        var resolvedStart = startDate ?? utcNow.AddDays(-29);

        var result = await reportService.GetSaleSummaryAsync(resolvedStart, resolvedEnd, ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/reports/inventory
    [HttpGet("inventory")]
    public async Task<IActionResult> GetInventory(CancellationToken ct = default)
    {
        if (!HasPermission("reports_inventory")) return Forbid();

        var result = await reportService.GetInventoryReportAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/reports/profit-loss?dateFrom=&dateTo=
    [HttpGet("profit-loss")]
    public async Task<IActionResult> GetProfitLoss(
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        CancellationToken ct = default)
    {
        if (!HasPermission("reports_summary")) return Forbid();

        if (dateFrom.HasValue && dateTo.HasValue && dateFrom > dateTo)
            return BadRequest(new { success = false, message = "dateFrom must be before dateTo." });

        var result = await reportService.GetProfitLossAsync(dateFrom, dateTo, ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/reports/purchases?startDate=&endDate=
    [HttpGet("purchases")]
    public async Task<IActionResult> GetPurchasesReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken ct = default)
    {
        if (!HasPermission("reports_purchases")) return Forbid();

        if (startDate.HasValue && endDate.HasValue && startDate > endDate)
            return BadRequest(new { success = false, message = "startDate must be before endDate." });

        var utcNow        = DateTime.UtcNow;
        var resolvedEnd   = endDate   ?? utcNow;
        var resolvedStart = startDate ?? utcNow.AddDays(-29);

        var result = await reportService.GetPurchaseReportAsync(resolvedStart, resolvedEnd, ct);
        return Ok(new { success = true, data = result });
    }
}
