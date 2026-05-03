using DemoPos.Api.DTOs.Permissions;

namespace DemoPos.Api.Services.Abstraction;

public interface IPermissionService
{
    Task<List<PermissionDto>> GetAllAsync(CancellationToken ct = default);
    Task<PermissionDto> CreateAsync(CreatePermissionRequest req, CancellationToken ct = default);
    Task<PermissionDto> UpdateAsync(int id, UpdatePermissionRequest req, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
