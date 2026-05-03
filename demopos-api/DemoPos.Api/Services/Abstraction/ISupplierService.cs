using DemoPos.Api.DTOs.Suppliers;

namespace DemoPos.Api.Services.Abstraction;

public interface ISupplierService
{
    Task<(IEnumerable<SupplierDto> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string? search, CancellationToken ct = default);
    Task<IEnumerable<SupplierDto>> GetAllAsync(string? search, CancellationToken ct = default);
    Task<IEnumerable<SupplierDto>> GetAllListAsync(CancellationToken ct = default);
    Task<SupplierDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<SupplierDto> CreateAsync(CreateSupplierRequest request, CancellationToken ct = default);
    Task<SupplierDto> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
    Task<bool> PhoneExistsAsync(string phone, int? excludeId = null, CancellationToken ct = default);
}
