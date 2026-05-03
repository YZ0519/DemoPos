using DemoPos.Api.DTOs.Customers;

namespace DemoPos.Api.Services.Abstraction;

public interface ICustomerService
{
    Task<(IEnumerable<CustomerDto> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string? search, CancellationToken ct = default);
    Task<IEnumerable<CustomerDto>> GetAllAsync(string? search, CancellationToken ct = default);
    Task<IEnumerable<CustomerDto>> GetAllListAsync(CancellationToken ct = default);
    Task<IEnumerable<CustomerSearchDto>> SearchAsync(string? q, int limit, CancellationToken ct = default);
    Task<CustomerDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default);
    Task<CustomerDto> UpdateAsync(int id, UpdateCustomerRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
    Task<bool> PhoneExistsAsync(string phone, int? excludeId = null, CancellationToken ct = default);
}
