using DemoPos.Api.DTOs.Voucher;

namespace DemoPos.Api.Services.Abstraction;

public interface IVoucherService
{
    Task<List<VoucherPackageDto>> GetAllAsync(CancellationToken ct = default);
    Task<List<VoucherPackageDto>> GetActiveAsync(CancellationToken ct = default);
    Task<VoucherValidationResult> ValidateAsync(string code, CancellationToken ct = default);
    Task<VoucherPackageDto> CreateAsync(CreateVoucherRequest request, CancellationToken ct = default);
    Task<VoucherPackageDto> UpdateAsync(int id, CreateVoucherRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
