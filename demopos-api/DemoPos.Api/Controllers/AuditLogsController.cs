using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.AuditLogs;

namespace DemoPos.Api.Controllers;

[Route("api/audit-logs")]
[Authorize]
public class AuditLogsController(AppDbContext db) : AppControllerBase
{
    // GET /api/audit-logs?page=1&pageSize=20&entityType=Sale&dateFrom=...&dateTo=...
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? entityType = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        CancellationToken ct = default)
    {
        if (!HasPermission("website_settings")) return Forbid();

        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.AuditLogs
            .AsNoTracking()
            .Include(a => a.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(a => a.EntityType == entityType);

        if (dateFrom.HasValue)
            query = query.Where(a => a.CreatedAt >= dateFrom.Value.ToUniversalTime());

        if (dateTo.HasValue)
        {
            var endOfDay = dateTo.Value.ToUniversalTime().Date.AddDays(1).AddTicks(-1);
            query = query.Where(a => a.CreatedAt <= endOfDay);
        }

        var totalCount = await query.CountAsync(ct);
        int totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling((double)totalCount / pageSize);

        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserId = a.UserId,
                UserName = a.User != null ? a.User.Name : null,
                Action = a.Action,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                Description = a.Description,
                IpAddress = a.IpAddress,
                CreatedAt = a.CreatedAt,
            })
            .ToListAsync(ct);

        return Ok(new
        {
            success = true,
            data = new { items = logs, totalCount, page, pageSize, totalPages }
        });
    }
}
