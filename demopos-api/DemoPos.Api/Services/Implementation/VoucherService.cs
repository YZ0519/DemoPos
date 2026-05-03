using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Constants;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Voucher;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class VoucherService(AppDbContext db, IMapper mapper) : IVoucherService
{
    private static readonly HashSet<string> ValidDiscountTypes  = [DiscountTypes.Fixed, DiscountTypes.Percentage, DiscountTypes.Override];
    private static readonly HashSet<string> ValidAppliesToTypes = ["all", "specific_items"];

    // ── GetAllAsync ────────────────────────────────────────────────────────────
    public async Task<List<VoucherPackageDto>> GetAllAsync(CancellationToken ct = default)
    {
        var vouchers = await db.VoucherPackages
            .AsNoTracking()
            .Include(v => v.Items)
                .ThenInclude(i => i.Product)
            .OrderBy(v => v.Name)
            .ToListAsync(ct);

        return mapper.Map<List<VoucherPackageDto>>(vouchers);
    }

    // ── GetActiveAsync ─────────────────────────────────────────────────────────
    public async Task<List<VoucherPackageDto>> GetActiveAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var vouchers = await db.VoucherPackages
            .AsNoTracking()
            .Include(v => v.Items)
                .ThenInclude(i => i.Product)
            .Where(v => v.IsActive
                && (v.ValidFrom == null || v.ValidFrom <= now)
                && (v.ValidUntil == null || v.ValidUntil >= now))
            .OrderBy(v => v.Name)
            .ToListAsync(ct);

        return mapper.Map<List<VoucherPackageDto>>(vouchers);
    }

    // ── ValidateAsync ──────────────────────────────────────────────────────────
    public async Task<VoucherValidationResult> ValidateAsync(string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return new VoucherValidationResult { IsValid = false, Message = "Voucher code is required." };

        var normalized = code.Trim().ToUpper();

        var voucher = await db.VoucherPackages
            .AsNoTracking()
            .Include(v => v.Items)
            .FirstOrDefaultAsync(v => v.Code == normalized, ct);

        if (voucher is null)
            return new VoucherValidationResult { IsValid = false, Code = code, Message = "Voucher not found." };

        if (!voucher.IsActive)
            return new VoucherValidationResult { IsValid = false, Code = code, Name = voucher.Name, Message = "Voucher is inactive." };

        var today = DateTime.UtcNow.Date;

        if (voucher.ValidFrom.HasValue && voucher.ValidFrom.Value.Date > today)
            return new VoucherValidationResult { IsValid = false, Code = code, Name = voucher.Name, Message = "Voucher is not yet valid." };

        if (voucher.ValidUntil.HasValue && voucher.ValidUntil.Value.Date < today)
            return new VoucherValidationResult { IsValid = false, Code = code, Name = voucher.Name, Message = "Voucher has expired." };

        return new VoucherValidationResult
        {
            IsValid       = true,
            Code          = voucher.Code,
            Name          = voucher.Name,
            DiscountType  = voucher.DiscountType,
            DiscountValue = voucher.DiscountValue,
            AppliesTo     = voucher.AppliesTo,
            Items         = voucher.Items.Select(i => new VoucherItemOverride
            {
                ProductId     = i.ProductId,
                OverridePrice = i.OverridePrice,
            }).ToList(),
            Message = "Voucher is valid.",
        };
    }

    // ── CreateAsync ────────────────────────────────────────────────────────────
    public async Task<VoucherPackageDto> CreateAsync(CreateVoucherRequest request, CancellationToken ct = default)
    {
        // ── Normalise and validate enum-like string fields ─────────────────────
        // [Required] on the DTO stops a JSON null reaching here, but we also
        // coalesce defensively in case the framework model-binding is lenient.
        var discountType = (request.DiscountType ?? DiscountTypes.Fixed).Trim().ToLower();
        var appliesTo    = (request.AppliesTo    ?? "all").Trim().ToLower();
        var items        = request.Items ?? [];

        if (!ValidDiscountTypes.Contains(discountType))
            throw new ArgumentException($"Invalid discountType '{discountType}'. Allowed values: fixed, percentage, override.");

        if (!ValidAppliesToTypes.Contains(appliesTo))
            throw new ArgumentException($"Invalid appliesTo '{appliesTo}'. Allowed values: all, specific_items.");

        if (appliesTo == "specific_items" && items.Count == 0)
            throw new ArgumentException("At least one item is required when appliesTo is 'specific_items'.");

        // ── Duplicate code check (case-insensitive — codes stored UPPER) ───────
        var normalized = request.Code.Trim().ToUpper();

        var exists = await db.VoucherPackages
            .AsNoTracking()
            .AnyAsync(v => v.Code == normalized, ct);

        if (exists)
            throw new InvalidOperationException($"A voucher with code '{normalized}' already exists.");

        var voucher = new VoucherPackage
        {
            Code          = normalized,
            Name          = request.Name.Trim(),
            Description   = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            DiscountType  = discountType,
            DiscountValue = request.DiscountValue,
            AppliesTo     = appliesTo,
            IsActive      = request.IsActive,
            ValidFrom     = request.ValidFrom,
            ValidUntil    = request.ValidUntil,
            CreatedAt     = DateTime.UtcNow,
            UpdatedAt     = DateTime.UtcNow,
            Items         = items.Select(i => new VoucherPackageItem
            {
                ProductId     = i.ProductId,
                OverridePrice = i.OverridePrice,
                CreatedAt     = DateTime.UtcNow,
            }).ToList(),
        };

        db.VoucherPackages.Add(voucher);
        await db.SaveChangesAsync(ct);

        var saved = await db.VoucherPackages
            .AsNoTracking()
            .Include(v => v.Items)
                .ThenInclude(i => i.Product)
            .FirstAsync(v => v.Id == voucher.Id, ct);

        return mapper.Map<VoucherPackageDto>(saved);
    }

    // ── UpdateAsync ────────────────────────────────────────────────────────────
    public async Task<VoucherPackageDto> UpdateAsync(int id, CreateVoucherRequest request, CancellationToken ct = default)
    {
        var voucher = await db.VoucherPackages
            .Include(v => v.Items)
            .FirstOrDefaultAsync(v => v.Id == id, ct)
            ?? throw new KeyNotFoundException($"Voucher {id} not found.");

        // ── Normalise and validate enum-like string fields ─────────────────────
        var discountType = (request.DiscountType ?? DiscountTypes.Fixed).Trim().ToLower();
        var appliesTo    = (request.AppliesTo    ?? "all").Trim().ToLower();
        var items        = request.Items ?? [];

        if (!ValidDiscountTypes.Contains(discountType))
            throw new ArgumentException($"Invalid discountType '{discountType}'. Allowed values: fixed, percentage, override.");

        if (!ValidAppliesToTypes.Contains(appliesTo))
            throw new ArgumentException($"Invalid appliesTo '{appliesTo}'. Allowed values: all, specific_items.");

        if (appliesTo == "specific_items" && items.Count == 0)
            throw new ArgumentException("At least one item is required when appliesTo is 'specific_items'.");

        var normalized = request.Code.Trim().ToUpper();

        var codeConflict = await db.VoucherPackages
            .AsNoTracking()
            .AnyAsync(v => v.Code == normalized && v.Id != id, ct);

        if (codeConflict)
            throw new InvalidOperationException($"A voucher with code '{normalized}' already exists.");

        voucher.Code          = normalized;
        voucher.Name          = request.Name.Trim();
        voucher.Description   = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        voucher.DiscountType  = discountType;
        voucher.DiscountValue = request.DiscountValue;
        voucher.AppliesTo     = appliesTo;
        voucher.IsActive      = request.IsActive;
        voucher.ValidFrom     = request.ValidFrom;
        voucher.ValidUntil    = request.ValidUntil;
        voucher.UpdatedAt     = DateTime.UtcNow;

        db.VoucherPackageItems.RemoveRange(voucher.Items);
        voucher.Items = items.Select(i => new VoucherPackageItem
        {
            VoucherPackageId = voucher.Id,
            ProductId        = i.ProductId,
            OverridePrice    = i.OverridePrice,
            CreatedAt        = DateTime.UtcNow,
        }).ToList();

        await db.SaveChangesAsync(ct);

        var saved = await db.VoucherPackages
            .AsNoTracking()
            .Include(v => v.Items)
                .ThenInclude(i => i.Product)
            .FirstAsync(v => v.Id == id, ct);

        return mapper.Map<VoucherPackageDto>(saved);
    }

    // ── DeleteAsync ────────────────────────────────────────────────────────────
    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var voucher = await db.VoucherPackages
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Id == id, ct)
            ?? throw new KeyNotFoundException($"Voucher {id} not found.");

        var usedInSales = await db.Sales
            .AsNoTracking()
            .AnyAsync(s => s.VoucherCode == voucher.Code, ct);

        if (usedInSales)
            throw new InvalidOperationException("Voucher has been used in sales and cannot be deleted.");

        await db.VoucherPackageItems
            .Where(i => i.VoucherPackageId == id)
            .ExecuteDeleteAsync(ct);

        await db.VoucherPackages
            .Where(v => v.Id == id)
            .ExecuteDeleteAsync(ct);
    }
}
