using DemoPos.Api.DTOs.Currencies;

namespace DemoPos.Api.Services.Abstraction;

public interface ICurrencyService
{
    Task<List<CurrencyDto>> GetAllAsync(CancellationToken ct = default);
    Task<CurrencyDto?> GetActiveAsync(CancellationToken ct = default);
    Task<CurrencyDto> CreateAsync(CreateOrUpdateCurrencyRequest req, CancellationToken ct = default);
    Task<CurrencyDto> UpdateAsync(int id, CreateOrUpdateCurrencyRequest req, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
    Task SetDefaultAsync(int id, CancellationToken ct = default);
}
