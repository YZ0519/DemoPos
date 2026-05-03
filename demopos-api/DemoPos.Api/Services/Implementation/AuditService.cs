using DemoPos.Api.Data;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class AuditService(AppDbContext db) : IAuditService
{
    public async Task LogAsync(
        string action,
        string entityType,
        string? entityId,
        string? description,
        int? userId,
        string? ipAddress,
        CancellationToken ct = default)
    {
        var log = new AuditLog
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Description = description,
            UserId = userId > 0 ? userId : null,
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow,
        };

        db.AuditLogs.Add(log);
        await db.SaveChangesAsync(ct);
    }
}
