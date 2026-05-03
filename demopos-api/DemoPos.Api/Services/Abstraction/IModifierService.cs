using DemoPos.Api.DTOs.Modifier;

namespace DemoPos.Api.Services.Abstraction;

public interface IModifierService
{
    Task<IEnumerable<ModifierGroupDto>> GetByProductAsync(int productId, CancellationToken ct);
    Task<ModifierGroupDto> CreateGroupAsync(CreateModifierGroupRequest req, CancellationToken ct);
    Task<ModifierGroupDto> UpdateGroupAsync(int groupId, CreateModifierGroupRequest req, CancellationToken ct);
    Task DeleteGroupAsync(int groupId, CancellationToken ct);
    Task<ModifierOptionDto> CreateOptionAsync(int groupId, CreateModifierOptionRequest req, CancellationToken ct);
    Task<ModifierOptionDto> UpdateOptionAsync(int groupId, int optionId, CreateModifierOptionRequest req, CancellationToken ct);
    Task DeleteOptionAsync(int groupId, int optionId, CancellationToken ct);
}
