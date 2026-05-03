using DemoPos.Api.DTOs.Units;

namespace DemoPos.Api.Services.Abstraction;

public interface IUnitService
{
    Task<List<UnitDto>> GetAllAsync(CancellationToken ct = default);
    Task<UnitDto> CreateAsync(CreateUnitRequest request, CancellationToken ct = default);
    Task<UnitDto> UpdateAsync(int id, UpdateUnitRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
