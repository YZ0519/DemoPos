using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Currencies;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class CurrencyService(AppDbContext db, IMapper mapper) : ICurrencyService
{
    public async Task<List<CurrencyDto>> GetAllAsync(CancellationToken ct = default)
    {
        var currencies = await db.Currencies
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        return mapper.Map<List<CurrencyDto>>(currencies);
    }

    public async Task<CurrencyDto?> GetActiveAsync(CancellationToken ct = default)
    {
        // Return the flagged default currency; fall back to BDT if none is marked active.
        var currency = await db.Currencies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Active, ct);

        if (currency is null)
        {
            // Fallback: find BDT by code as per project default
            currency = await db.Currencies
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Code == "BDT", ct);
        }

        return currency is null ? null : mapper.Map<CurrencyDto>(currency);
    }

    public async Task<CurrencyDto> CreateAsync(CreateOrUpdateCurrencyRequest req, CancellationToken ct = default)
    {
        var code = req.Code.Trim().ToUpperInvariant();

        if (await db.Currencies.AnyAsync(c => c.Code == code, ct))
            throw new InvalidOperationException($"A currency with code '{code}' already exists.");

        var currency = new Currency
        {
            Name      = req.Name.Trim(),
            Code      = code,
            Symbol    = req.Symbol.Trim(),
            Active    = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.Currencies.Add(currency);
        await db.SaveChangesAsync(ct);

        return mapper.Map<CurrencyDto>(currency);
    }

    public async Task<CurrencyDto> UpdateAsync(int id, CreateOrUpdateCurrencyRequest req, CancellationToken ct = default)
    {
        var currency = await db.Currencies.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new KeyNotFoundException("Currency not found.");

        var code = req.Code.Trim().ToUpperInvariant();

        // Unique code check — exclude self
        if (await db.Currencies.AnyAsync(c => c.Code == code && c.Id != id, ct))
            throw new InvalidOperationException($"A currency with code '{code}' already exists.");

        currency.Name      = req.Name.Trim();
        currency.Code      = code;
        currency.Symbol    = req.Symbol.Trim();
        currency.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return mapper.Map<CurrencyDto>(currency);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var currency = await db.Currencies.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new KeyNotFoundException("Currency not found.");

        if (currency.Active)
            throw new InvalidOperationException("Cannot delete the default currency. Set another currency as default first.");

        db.Currencies.Remove(currency);
        await db.SaveChangesAsync(ct);
    }

    public async Task SetDefaultAsync(int id, CancellationToken ct = default)
    {
        var currency = await db.Currencies.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new KeyNotFoundException("Currency not found.");

        // Wrap in a transaction so the bulk-clear and the single-set are atomic.
        // Without this, a crash between the two writes could leave no default currency.
        await using var txn = await db.Database.BeginTransactionAsync(ct);

        // Clear current default flag on all currencies
        await db.Currencies.ExecuteUpdateAsync(
            s => s.SetProperty(c => c.Active, false),
            ct);

        currency.Active    = true;
        currency.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await txn.CommitAsync(ct);
    }
}
