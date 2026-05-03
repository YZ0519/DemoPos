using DemoPos.Api.DTOs.PaymentMethods;

namespace DemoPos.Api.Services.Abstraction;

public interface IPaymentMethodService
{
    Task<List<PaymentMethodDto>> GetAllAsync(bool activeOnly = false, CancellationToken ct = default);
    Task<PaymentMethodDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<PaymentMethodDto> CreateAsync(CreatePaymentMethodRequest request, CancellationToken ct = default);
    Task<PaymentMethodDto> UpdateAsync(int id, UpdatePaymentMethodRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
