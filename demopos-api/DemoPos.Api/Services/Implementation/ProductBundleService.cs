using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.ProductBundle;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class ProductBundleService(AppDbContext db, IMapper mapper) : IProductBundleService
{
    // ── GetAllAsync ────────────────────────────────────────────────────────────
    public async Task<IEnumerable<ProductBundleDto>> GetAllAsync(
        bool? activeOnly,
        CancellationToken ct = default)
    {
        IQueryable<ProductBundle> query = BundlesWithSteps();

        if (activeOnly == true)
            query = query.Where(b => b.IsActive);

        var bundles = await query
            .OrderBy(b => b.Name)
            .ToListAsync(ct);

        return mapper.Map<List<ProductBundleDto>>(bundles);
    }

    // ── CreateAsync ────────────────────────────────────────────────────────────
    public async Task<ProductBundleDto> CreateAsync(
        CreateProductBundleRequest req,
        CancellationToken ct = default)
    {
        var (minItems, maxItems) = await ResolveItemBoundsAsync(req.Steps, req.MinItems, req.MaxItems, ct);

        // Wrap in transaction so bundle + steps are atomic (no orphan bundles on step failure)
        await using var txn = await db.Database.BeginTransactionAsync(ct);

        var bundle = new ProductBundle
        {
            Name      = req.Name.Trim(),
            Price     = req.Price,
            MinItems  = minItems,
            MaxItems  = maxItems,
            IsActive  = req.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.ProductBundles.Add(bundle);
        await db.SaveChangesAsync(ct);

        if (req.Steps is { Count: > 0 })
            await CreateStepsAsync(bundle.Id, req.Steps, ct);

        await txn.CommitAsync(ct);
        return await GetByIdMappedAsync(bundle.Id, ct);
    }

    // ── UpdateAsync ────────────────────────────────────────────────────────────
    public async Task<ProductBundleDto> UpdateAsync(
        int id,
        UpdateProductBundleRequest req,
        CancellationToken ct = default)
    {
        var bundle = await db.ProductBundles
            .Include(b => b.Steps)
                .ThenInclude(s => s.StepProducts)
            .FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new KeyNotFoundException($"Bundle {id} not found.");

        var (minItems, maxItems) = await ResolveItemBoundsAsync(req.Steps, req.MinItems, req.MaxItems, ct);

        // Wrap step delete-and-recreate in a transaction for atomicity
        await using var txn = await db.Database.BeginTransactionAsync(ct);

        bundle.Name      = req.Name.Trim();
        bundle.Price     = req.Price;
        bundle.MinItems  = minItems;
        bundle.MaxItems  = maxItems;
        bundle.IsActive  = req.IsActive;
        bundle.UpdatedAt = DateTime.UtcNow;

        // Delete-and-recreate strategy for steps
        if (bundle.Steps.Count > 0)
            db.BundleSteps.RemoveRange(bundle.Steps);

        if (req.Steps is { Count: > 0 })
        {
            // Flush removal + scalar updates, then create new steps
            await db.SaveChangesAsync(ct);
            await CreateStepsAsync(bundle.Id, req.Steps, ct);
        }
        else
        {
            await db.SaveChangesAsync(ct);
        }

        await txn.CommitAsync(ct);
        return await GetByIdMappedAsync(bundle.Id, ct);
    }

    // ── DeleteAsync ────────────────────────────────────────────────────────────
    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var bundle = await db.ProductBundles
            .FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new KeyNotFoundException($"Bundle {id} not found.");

        var isInUse = await db.SaleItems
            .AsNoTracking()
            .AnyAsync(si => si.ProductBundleId == id, ct);

        if (isInUse)
            throw new InvalidOperationException(
                "Bundle has been used in sales. Deactivate it instead.");

        db.ProductBundles.Remove(bundle);
        await db.SaveChangesAsync(ct);
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    /// <summary>
    /// Shared include chain for loading bundles with full step/product navigation.
    /// </summary>
    private IQueryable<ProductBundle> BundlesWithSteps()
        => db.ProductBundles
            .AsNoTracking()
            .Include(b => b.Steps.OrderBy(s => s.SortOrder))
                .ThenInclude(s => s.StepProducts.OrderBy(sp => sp.SortOrder))
                    .ThenInclude(sp => sp.Product);

    /// <summary>
    /// Validates steps (if present) and returns the resolved (minItems, maxItems).
    /// Extracts duplicated logic from CreateAsync / UpdateAsync.
    /// </summary>
    private async Task<(int MinItems, int MaxItems)> ResolveItemBoundsAsync(
        List<BundleStepInput>? steps, int fallbackMin, int fallbackMax, CancellationToken ct)
    {
        if (steps is { Count: > 0 })
        {
            await ValidateStepsAsync(steps, ct);
            return (steps.Sum(s => s.MinQuantity), steps.Sum(s => s.MaxQuantity));
        }

        if (fallbackMax < fallbackMin)
            throw new ArgumentException(
                $"MaxItems ({fallbackMax}) cannot be less than MinItems ({fallbackMin}).");

        return (fallbackMin, fallbackMax);
    }

    /// <summary>
    /// Validates step definitions: min/max constraints, optional step rules,
    /// and product existence.
    /// </summary>
    private async Task ValidateStepsAsync(List<BundleStepInput> steps, CancellationToken ct)
    {
        var allProductIds = steps
            .SelectMany(s => s.ProductIds)
            .Distinct()
            .ToList();

        var existingSet = (await db.Products
            .AsNoTracking()
            .Where(p => allProductIds.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync(ct))
            .ToHashSet();

        for (int i = 0; i < steps.Count; i++)
        {
            var step = steps[i];
            var stepLabel = $"Step {i + 1} ('{step.Label}')";

            if (step.MaxQuantity < step.MinQuantity)
                throw new ArgumentException(
                    $"{stepLabel}: MaxQuantity ({step.MaxQuantity}) cannot be less than MinQuantity ({step.MinQuantity}).");

            if (step.IsOptional && step.MinQuantity != 0)
                throw new ArgumentException(
                    $"{stepLabel}: Optional steps must have MinQuantity = 0.");

            if (step.ProductIds.Count == 0)
                throw new ArgumentException(
                    $"{stepLabel}: Must have at least one product.");

            var missingIds = step.ProductIds.Where(id => !existingSet.Contains(id)).ToList();
            if (missingIds.Count > 0)
                throw new KeyNotFoundException(
                    $"{stepLabel}: Product IDs not found: {string.Join(", ", missingIds)}.");
        }
    }

    /// <summary>
    /// Creates BundleStep and BundleStepProduct rows in 2 batched saves (not N+1).
    /// </summary>
    private async Task CreateStepsAsync(int bundleId, List<BundleStepInput> steps, CancellationToken ct)
    {
        // 1. Add all steps in one batch to get their IDs
        var stepEntities = new List<(BundleStep Entity, List<int> ProductIds)>();
        for (int i = 0; i < steps.Count; i++)
        {
            var input = steps[i];
            var step = new BundleStep
            {
                ProductBundleId = bundleId,
                Label           = input.Label.Trim(),
                SortOrder       = i,
                MinQuantity     = input.MinQuantity,
                MaxQuantity     = input.MaxQuantity,
                IsOptional      = input.IsOptional,
                CreatedAt       = DateTime.UtcNow,
                UpdatedAt       = DateTime.UtcNow,
            };
            db.BundleSteps.Add(step);
            stepEntities.Add((step, input.ProductIds));
        }
        await db.SaveChangesAsync(ct); // IDs now populated

        // 2. Add all step-products using resolved IDs, one final save
        foreach (var (step, productIds) in stepEntities)
        {
            for (int j = 0; j < productIds.Count; j++)
            {
                db.BundleStepProducts.Add(new BundleStepProduct
                {
                    BundleStepId = step.Id,
                    ProductId    = productIds[j],
                    SortOrder    = j + 1,
                });
            }
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Loads a single bundle with full step/product navigation and maps to DTO.
    /// </summary>
    private async Task<ProductBundleDto> GetByIdMappedAsync(int bundleId, CancellationToken ct)
    {
        var bundle = await BundlesWithSteps()
            .FirstAsync(b => b.Id == bundleId, ct);

        return mapper.Map<ProductBundleDto>(bundle);
    }
}
