using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Settings;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class SettingService(AppDbContext db) : ISettingService
{
    public async Task<Dictionary<string, string?>> GetAllAsync(CancellationToken ct = default)
    {
        var settings = await db.Settings
            .AsNoTracking()
            .ToListAsync(ct);

        return settings.ToDictionary(s => s.Key, s => s.Value);
    }

    public async Task UpdateGeneralAsync(UpdateGeneralSettingsRequest req, CancellationToken ct = default)
    {
        await UpsertAsync("site_name",        "general", req.SiteName,                      ct);
        await UpsertAsync("site_url",         "general", req.SiteUrl,                       ct);
        await UpsertAsync("meta_description", "general", req.MetaDescription,               ct);
        await UpsertAsync("rounding_enabled",          "general", BoolStr(req.RoundingEnabled),                  ct);
        await UpsertAsync("rounding_quantum",          "general", req.RoundingQuantum ?? "0.05",                  ct);
        await UpsertAsync("purchase_rounding_enabled", "general", BoolStr(req.PurchaseRoundingEnabled),           ct);
        await UpsertAsync("purchase_rounding_quantum", "general", req.PurchaseRoundingQuantum ?? "0.05",          ct);

        // Restaurant settings (Phase 3)
        await UpsertAsync("restaurant_mode",           "general", BoolStr(req.RestaurantMode),                   ct);
        await UpsertAsync("takeaway_charge_enabled",   "general", BoolStr(req.TakeawayChargeEnabled),            ct);
        await UpsertAsync("takeaway_charge_amount",    "general", req.TakeawayChargeAmount.ToString("F2"),       ct);

        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateContactsAsync(UpdateContactSettingsRequest req, CancellationToken ct = default)
    {
        await UpsertAsync("contact_phone",   "contacts", req.ContactPhone,   ct);
        await UpsertAsync("contact_email",   "contacts", req.ContactEmail,   ct);
        await UpsertAsync("contact_address", "contacts", req.ContactAddress, ct);
        await UpsertAsync("contact_fax",     "contacts", req.ContactFax,     ct);
        await UpsertAsync("contact_mobile",  "contacts", req.ContactMobile,  ct);
        await UpsertAsync("working_hour",    "contacts", req.WorkingHour,    ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateInvoiceAsync(UpdateInvoiceSettingsRequest req, CancellationToken ct = default)
    {
        await UpsertAsync("note_to_customer",  "invoice", req.NoteToCustomer,              ct);
        await UpsertAsync("receipt_maxwidth",  "invoice", req.ReceiptMaxWidth,             ct);
        await UpsertAsync("is_show_logo",      "invoice", BoolStr(req.IsShowLogo),         ct);
        await UpsertAsync("is_show_site_name", "invoice", BoolStr(req.IsShowSiteName),     ct);
        await UpsertAsync("is_show_phone",     "invoice", BoolStr(req.IsShowPhone),        ct);
        await UpsertAsync("is_show_email",     "invoice", BoolStr(req.IsShowEmail),        ct);
        await UpsertAsync("is_show_address",   "invoice", BoolStr(req.IsShowAddress),      ct);
        await UpsertAsync("is_show_customer",  "invoice", BoolStr(req.IsShowCustomer),     ct);
        await UpsertAsync("is_show_note",      "invoice", BoolStr(req.IsShowNote),         ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAppearanceAsync(AppearanceSettingsDto dto, CancellationToken ct = default)
    {
        await UpsertAsync("dark_mode", "general", BoolStr(dto.DarkMode), ct);
        await db.SaveChangesAsync(ct);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Looks up an existing Setting row by key and mutates its Value,
    /// or adds a new row if none exists.
    /// SaveChangesAsync must be called by the caller after all upserts.
    /// </summary>
    private async Task UpsertAsync(string key, string group, string? value, CancellationToken ct)
    {
        var existing = await db.Settings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (existing is not null)
        {
            existing.Value     = value;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.Settings.Add(new Setting
            {
                Key       = key,
                Value     = value,
                Group     = group,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }
    }

    private static string BoolStr(bool value) => value ? "true" : "false";
}
