using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Settings;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/settings")]
[Authorize]
public class SettingsController(ISettingService settings) : AppControllerBase
{
    // GET /api/settings — accessible to all authenticated users (no extra permission)
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await settings.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // PUT /api/settings/general
    [HttpPut("general")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateGeneral([FromBody] UpdateGeneralSettingsRequest request, CancellationToken ct)
    {
        if (!HasPermission("website_settings")) return Forbid();

        await settings.UpdateGeneralAsync(request, ct);
        return Ok(new { success = true });
    }

    // PUT /api/settings/contacts
    [HttpPut("contacts")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateContacts([FromBody] UpdateContactSettingsRequest request, CancellationToken ct)
    {
        if (!HasPermission("contact_settings")) return Forbid();

        await settings.UpdateContactsAsync(request, ct);
        return Ok(new { success = true });
    }

    // PUT /api/settings/invoice
    [HttpPut("invoice")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateInvoice([FromBody] UpdateInvoiceSettingsRequest request, CancellationToken ct)
    {
        if (!HasPermission("invoice_settings")) return Forbid();

        await settings.UpdateInvoiceAsync(request, ct);
        return Ok(new { success = true });
    }

    // PUT /api/settings/appearance — no extra permission required; any authenticated user can toggle their dark mode preference
    [HttpPut("appearance")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateAppearance([FromBody] AppearanceSettingsDto dto, CancellationToken ct)
    {
        await settings.UpdateAppearanceAsync(dto, ct);
        return Ok(new { success = true });
    }
}
