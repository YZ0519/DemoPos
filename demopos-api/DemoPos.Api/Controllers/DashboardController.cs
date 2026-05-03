using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/dashboard")]
[Authorize]
public class DashboardController(IDashboardService dashboardService) : AppControllerBase
{
    // GET /api/dashboard?dateFrom=&dateTo=
    [HttpGet]
    public async Task<IActionResult> GetDashboard(
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        CancellationToken ct = default)
    {
        if (dateFrom.HasValue && dateTo.HasValue && dateFrom > dateTo)
            return BadRequest(new { success = false, message = "dateFrom must be before dateTo." });

        var result = await dashboardService.GetDashboardAsync(dateFrom, dateTo, ct);
        return Ok(new { success = true, data = result });
    }
}
