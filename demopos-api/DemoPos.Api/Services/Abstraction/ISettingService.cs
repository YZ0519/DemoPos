using DemoPos.Api.DTOs.Settings;

namespace DemoPos.Api.Services.Abstraction;

public interface ISettingService
{
    Task<Dictionary<string, string?>> GetAllAsync(CancellationToken ct = default);
    Task UpdateGeneralAsync(UpdateGeneralSettingsRequest req, CancellationToken ct = default);
    Task UpdateContactsAsync(UpdateContactSettingsRequest req, CancellationToken ct = default);
    Task UpdateInvoiceAsync(UpdateInvoiceSettingsRequest req, CancellationToken ct = default);
    Task UpdateAppearanceAsync(AppearanceSettingsDto dto, CancellationToken ct = default);
}
