using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.PaymentMethods;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class PaymentMethodService(AppDbContext db, IMapper mapper) : IPaymentMethodService
{
    // ── GetAllAsync ────────────────────────────────────────────────────────────
    public async Task<List<PaymentMethodDto>> GetAllAsync(
        bool activeOnly = false,
        CancellationToken ct = default)
    {
        IQueryable<PaymentMethod> query = db.PaymentMethods.AsNoTracking();

        if (activeOnly)
            query = query.Where(pm => pm.IsActive);

        var methods = await query
            .OrderBy(pm => pm.SortOrder)
            .ThenBy(pm => pm.Name)
            .ToListAsync(ct);

        return mapper.Map<List<PaymentMethodDto>>(methods);
    }

    // ── GetByIdAsync ───────────────────────────────────────────────────────────
    public async Task<PaymentMethodDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var method = await db.PaymentMethods
            .AsNoTracking()
            .FirstOrDefaultAsync(pm => pm.Id == id, ct);

        return method is null ? null : mapper.Map<PaymentMethodDto>(method);
    }

    // ── CreateAsync ────────────────────────────────────────────────────────────
    public async Task<PaymentMethodDto> CreateAsync(
        CreatePaymentMethodRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Payment method name is required.");

        var nameNormalised = request.Name.Trim();

        var nameExists = await db.PaymentMethods
            .AsNoTracking()
            .AnyAsync(pm => pm.Name.ToLower() == nameNormalised.ToLower(), ct);

        if (nameExists)
            throw new ArgumentException($"A payment method named '{nameNormalised}' already exists.");

        // If this new method is marked as default, clear the flag on all others
        if (request.IsDefault)
            await ClearDefaultFlagAsync(excludeId: null, ct);

        var method = new PaymentMethod
        {
            Name           = nameNormalised,
            IsActive       = request.IsActive,
            IsDefault      = request.IsDefault,
            SortOrder      = request.SortOrder,
            AutoFillAmount = request.AutoFillAmount,
            ZeroTotal      = request.ZeroTotal,
            CreatedAt      = DateTime.UtcNow,
            UpdatedAt      = DateTime.UtcNow,
        };

        db.PaymentMethods.Add(method);
        await db.SaveChangesAsync(ct);

        return mapper.Map<PaymentMethodDto>(method);
    }

    // ── UpdateAsync ────────────────────────────────────────────────────────────
    public async Task<PaymentMethodDto> UpdateAsync(
        int id,
        UpdatePaymentMethodRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Payment method name is required.");

        var method = await db.PaymentMethods
            .FirstOrDefaultAsync(pm => pm.Id == id, ct)
            ?? throw new KeyNotFoundException($"Payment method {id} not found.");

        var nameNormalised = request.Name.Trim();

        // Uniqueness check excluding self
        var nameExists = await db.PaymentMethods
            .AsNoTracking()
            .AnyAsync(pm => pm.Name.ToLower() == nameNormalised.ToLower() && pm.Id != id, ct);

        if (nameExists)
            throw new ArgumentException($"A payment method named '{nameNormalised}' already exists.");

        // If this method is being set as default, clear the flag on all others first
        if (request.IsDefault)
            await ClearDefaultFlagAsync(excludeId: id, ct);

        method.Name           = nameNormalised;
        method.IsActive       = request.IsActive;
        method.IsDefault      = request.IsDefault;
        method.SortOrder      = request.SortOrder;
        method.AutoFillAmount = request.AutoFillAmount;
        method.ZeroTotal      = request.ZeroTotal;
        method.UpdatedAt      = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return mapper.Map<PaymentMethodDto>(method);
    }

    // ── DeleteAsync ────────────────────────────────────────────────────────────
    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var method = await db.PaymentMethods
            .FirstOrDefaultAsync(pm => pm.Id == id, ct)
            ?? throw new KeyNotFoundException($"Payment method {id} not found.");

        // Guard 1: cannot delete the default payment method
        if (method.IsDefault)
            throw new InvalidOperationException(
                "Cannot delete the default payment method. Set another method as default first.");

        // Guard 2: cannot delete if referenced by sale transactions
        var usedInTransactions = await db.SaleTransactions
            .AsNoTracking()
            .AnyAsync(ot => ot.PaymentMethodId == id, ct);

        if (usedInTransactions)
            throw new InvalidOperationException(
                "Cannot delete this payment method because it is referenced by one or more sale transactions.");

        // Guard 3: cannot delete if referenced by purchases
        var usedInPurchases = await db.Purchases
            .AsNoTracking()
            .AnyAsync(p => p.PaymentMethodId == id, ct);

        if (usedInPurchases)
            throw new InvalidOperationException(
                "Cannot delete this payment method because it is referenced by one or more purchases.");

        db.PaymentMethods.Remove(method);
        await db.SaveChangesAsync(ct);
    }

    // ── ClearDefaultFlagAsync (private) ───────────────────────────────────────
    // Sets IsDefault = false on all payment methods except the one with excludeId.
    // Pass null for excludeId when creating (no row to preserve yet).
    private async Task ClearDefaultFlagAsync(int? excludeId, CancellationToken ct)
    {
        var currentDefaults = await db.PaymentMethods
            .Where(pm => pm.IsDefault && (excludeId == null || pm.Id != excludeId.Value))
            .ToListAsync(ct);

        foreach (var pm in currentDefaults)
        {
            pm.IsDefault = false;
            pm.UpdatedAt = DateTime.UtcNow;
        }

        if (currentDefaults.Count > 0)
            await db.SaveChangesAsync(ct);
    }
}
