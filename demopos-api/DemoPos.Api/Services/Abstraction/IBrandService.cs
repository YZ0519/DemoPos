using DemoPos.Api.DTOs.Brands;

namespace DemoPos.Api.Services.Abstraction;

public interface IBrandService
{
    Task<List<BrandDto>> GetAllAsync(CancellationToken ct = default);
    Task<BrandDto> CreateAsync(CreateBrandRequest request, CancellationToken ct = default);
    Task<BrandDto> UpdateAsync(int id, UpdateBrandRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
