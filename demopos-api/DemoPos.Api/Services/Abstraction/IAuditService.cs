namespace DemoPos.Api.Services.Abstraction;

public interface IAuditService
{
    Task LogAsync(
        string action,
        string entityType,
        string? entityId,
        string? description,
        int? userId,
        string? ipAddress,
        CancellationToken ct = default);
}
