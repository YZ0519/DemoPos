using DemoPos.Api.DTOs.Roles;

namespace DemoPos.Api.Services.Abstraction;

public interface IRoleService
{
    Task<List<RoleDto>> GetAllAsync(CancellationToken ct = default);
    Task<RoleDto> CreateAsync(CreateRoleRequest req, CancellationToken ct = default);
    Task<RoleDto> UpdateAsync(int id, UpdateRoleRequest req, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
    Task<List<string>> GetPermissionsAsync(int id, CancellationToken ct = default);
    Task<RoleDto> SyncPermissionsAsync(int id, SyncPermissionsRequest req, CancellationToken ct = default);
}
