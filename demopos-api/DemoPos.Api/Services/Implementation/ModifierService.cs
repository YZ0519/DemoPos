using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Modifier;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class ModifierService(AppDbContext db, IMapper mapper) : IModifierService
{
    // ── GetByProductAsync ──────────────────────────────────────────────────────
    public async Task<IEnumerable<ModifierGroupDto>> GetByProductAsync(int productId, CancellationToken ct)
    {
        var groups = await db.ProductModifierGroups
            .AsNoTracking()
            .Where(g => g.ProductId == productId)
            .Include(g => g.Options.OrderBy(o => o.SortOrder))
            .OrderBy(g => g.SortOrder)
            .ThenBy(g => g.Id)
            .ToListAsync(ct);

        return mapper.Map<IEnumerable<ModifierGroupDto>>(groups);
    }

    // ── CreateGroupAsync ───────────────────────────────────────────────────────
    public async Task<ModifierGroupDto> CreateGroupAsync(CreateModifierGroupRequest req, CancellationToken ct)
    {
        // Ensure the parent product exists
        var productExists = await db.Products
            .AsNoTracking()
            .AnyAsync(p => p.Id == req.ProductId, ct);

        if (!productExists)
            throw new KeyNotFoundException($"Product {req.ProductId} not found.");

        var group = new ProductModifierGroup
        {
            ProductId     = req.ProductId,
            Name          = req.Name.Trim(),
            IsRequired    = req.IsRequired,
            MinSelections = req.MinSelections,
            MaxSelections = req.MaxSelections,
            SortOrder     = req.SortOrder,
            IsActive      = req.IsActive,
            CreatedAt     = DateTime.UtcNow,
            UpdatedAt     = DateTime.UtcNow,
        };

        db.ProductModifierGroups.Add(group);
        await db.SaveChangesAsync(ct);

        // Reload with Options to build the DTO (Options will be empty on create)
        var created = await db.ProductModifierGroups
            .AsNoTracking()
            .Include(g => g.Options.OrderBy(o => o.SortOrder))
            .FirstAsync(g => g.Id == group.Id, ct);

        return mapper.Map<ModifierGroupDto>(created);
    }

    // ── UpdateGroupAsync ───────────────────────────────────────────────────────
    public async Task<ModifierGroupDto> UpdateGroupAsync(int groupId, CreateModifierGroupRequest req, CancellationToken ct)
    {
        var group = await db.ProductModifierGroups
            .Include(g => g.Options.OrderBy(o => o.SortOrder))
            .FirstOrDefaultAsync(g => g.Id == groupId, ct)
            ?? throw new KeyNotFoundException($"Modifier group {groupId} not found.");

        group.Name          = req.Name.Trim();
        group.IsRequired    = req.IsRequired;
        group.MinSelections = req.MinSelections;
        group.MaxSelections = req.MaxSelections;
        group.SortOrder     = req.SortOrder;
        group.IsActive      = req.IsActive;
        group.UpdatedAt     = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return mapper.Map<ModifierGroupDto>(group);
    }

    // ── DeleteGroupAsync ───────────────────────────────────────────────────────
    public async Task DeleteGroupAsync(int groupId, CancellationToken ct)
    {
        var group = await db.ProductModifierGroups
            .FirstOrDefaultAsync(g => g.Id == groupId, ct)
            ?? throw new KeyNotFoundException($"Modifier group {groupId} not found.");

        db.ProductModifierGroups.Remove(group);
        await db.SaveChangesAsync(ct);
    }

    // ── CreateOptionAsync ──────────────────────────────────────────────────────
    public async Task<ModifierOptionDto> CreateOptionAsync(int groupId, CreateModifierOptionRequest req, CancellationToken ct)
    {
        var groupExists = await db.ProductModifierGroups
            .AsNoTracking()
            .AnyAsync(g => g.Id == groupId, ct);

        if (!groupExists)
            throw new KeyNotFoundException($"Modifier group {groupId} not found.");

        var option = new ProductModifierOption
        {
            ModifierGroupId  = groupId,
            Name             = req.Name.Trim(),
            PriceAdjustment  = req.PriceAdjustment,
            SortOrder        = req.SortOrder,
            IsActive         = req.IsActive,
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
        };

        db.ProductModifierOptions.Add(option);
        await db.SaveChangesAsync(ct);

        return mapper.Map<ModifierOptionDto>(option);
    }

    // ── UpdateOptionAsync ──────────────────────────────────────────────────────
    public async Task<ModifierOptionDto> UpdateOptionAsync(int groupId, int optionId, CreateModifierOptionRequest req, CancellationToken ct)
    {
        var option = await db.ProductModifierOptions
            .FirstOrDefaultAsync(o => o.Id == optionId && o.ModifierGroupId == groupId, ct)
            ?? throw new KeyNotFoundException($"Option {optionId} not found in modifier group {groupId}.");

        option.Name            = req.Name.Trim();
        option.PriceAdjustment = req.PriceAdjustment;
        option.SortOrder       = req.SortOrder;
        option.IsActive        = req.IsActive;
        option.UpdatedAt       = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return mapper.Map<ModifierOptionDto>(option);
    }

    // ── DeleteOptionAsync ──────────────────────────────────────────────────────
    public async Task DeleteOptionAsync(int groupId, int optionId, CancellationToken ct)
    {
        var option = await db.ProductModifierOptions
            .FirstOrDefaultAsync(o => o.Id == optionId && o.ModifierGroupId == groupId, ct)
            ?? throw new KeyNotFoundException($"Option {optionId} not found in modifier group {groupId}.");

        db.ProductModifierOptions.Remove(option);
        await db.SaveChangesAsync(ct);
    }
}
