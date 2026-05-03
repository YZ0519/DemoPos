using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Cart;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class CartService(AppDbContext db) : ICartService
{
    // ── ClearAsync ────────────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> ClearAsync(int userId, CancellationToken ct = default)
    {
        var items = await db.PosCarts
            .Where(c => c.UserId == userId)
            .ToListAsync(ct);

        if (items.Count > 0)
        {
            // Remove sub-items first so the self-referencing FK constraint
            // (BundleHeaderPosCartId → Id) is satisfied before headers are deleted.
            var subItems = items.Where(c => c.BundleHeaderPosCartId != null).ToList();
            var headers  = items.Where(c => c.BundleHeaderPosCartId == null).ToList();

            db.PosCarts.RemoveRange(subItems);
            db.PosCarts.RemoveRange(headers);
            await db.SaveChangesAsync(ct);
        }

        return [];
    }

    // ── GetAsync ──────────────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> GetAsync(int userId, CancellationToken ct = default)
    {
        var items = await db.PosCarts
            .AsNoTracking()
            .Include(c => c.Product)
            .Include(c => c.ProductBundle)
            .Include(c => c.BundleStep)
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(ct);

        return items.Select(MapToDto).ToList();
    }

    // ── AddAsync ──────────────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> AddAsync(int userId, int productId, CancellationToken ct = default)
    {
        var product = await db.Products
            .FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new KeyNotFoundException("Product not found.");

        if (!product.Status)
            throw new ArgumentException("Product is not active.");

        if (product.Quantity < 1)
            throw new ArgumentException("Product is out of stock.");

        var existing = await db.PosCarts
            .FirstOrDefaultAsync(c => c.UserId == userId && c.ProductId == productId, ct);

        if (existing is not null)
        {
            if (existing.Quantity >= product.Quantity)
                throw new InvalidOperationException(
                    $"Cannot add more than the available stock ({product.Quantity}).");

            existing.Quantity++;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.PosCarts.Add(new PosCart
            {
                UserId    = userId,
                ProductId = productId,
                Quantity  = 1,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }

    // ── IncrementAsync ────────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> IncrementAsync(int userId, int cartItemId, CancellationToken ct = default)
    {
        var item = await db.PosCarts
            .Include(c => c.Product)
            .FirstOrDefaultAsync(c => c.Id == cartItemId && c.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Cart item not found.");

        // Bundle header rows have no product — increment is not quantity-capped.
        if (item.Product is not null && item.Quantity >= item.Product.Quantity)
            throw new InvalidOperationException(
                $"Cannot exceed available stock ({item.Product.Quantity}).");

        item.Quantity++;
        item.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return await GetAsync(userId, ct);
    }

    // ── DecrementAsync ────────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> DecrementAsync(int userId, int cartItemId, CancellationToken ct = default)
    {
        var item = await db.PosCarts
            .FirstOrDefaultAsync(c => c.Id == cartItemId && c.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Cart item not found.");

        if (item.Quantity <= 1)
        {
            db.PosCarts.Remove(item);
        }
        else
        {
            item.Quantity--;
            item.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, ct);
    }

    // ── RemoveAsync ───────────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> RemoveAsync(int userId, int cartItemId, CancellationToken ct = default)
    {
        var item = await db.PosCarts
            .FirstOrDefaultAsync(c => c.Id == cartItemId && c.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Cart item not found.");

        db.PosCarts.Remove(item);
        await db.SaveChangesAsync(ct);

        return await GetAsync(userId, ct);
    }

    // ── AddBundleAsync ────────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> AddBundleAsync(
        int userId,
        AddBundleRequest request,
        CancellationToken ct = default)
    {
        // Load and validate the bundle definition (with steps for step-based bundles)
        var bundle = await db.ProductBundles
            .AsNoTracking()
            .Include(b => b.Steps)
                .ThenInclude(s => s.StepProducts)
            .FirstOrDefaultAsync(b => b.Id == request.BundleId, ct)
            ?? throw new KeyNotFoundException("Bundle not found.");

        if (!bundle.IsActive)
            throw new ArgumentException("Bundle is not active.");

        if (request.SelectedProducts.Count == 0)
            throw new ArgumentException("At least one product must be selected for the bundle.");

        var hasSteps = bundle.Steps.Count > 0;

        if (hasSteps)
        {
            // Step-based validation
            ValidateStepSelections(bundle, request.SelectedProducts);
        }
        else
        {
            // Flat bundle validation — total quantity must be within [MinItems, MaxItems]
            var totalQuantity = request.SelectedProducts.Sum(p => p.Quantity);
            if (totalQuantity < bundle.MinItems)
                throw new ArgumentException(
                    $"Total selected quantity ({totalQuantity}) is below the bundle minimum ({bundle.MinItems}).");

            if (totalQuantity > bundle.MaxItems)
                throw new ArgumentException(
                    $"Total selected quantity ({totalQuantity}) exceeds the bundle maximum ({bundle.MaxItems}).");
        }

        // Batch-load all referenced products in one query (N+1 prevention)
        var productIds = request.SelectedProducts.Select(p => p.ProductId).Distinct().ToList();
        var products   = await db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        // Validate each selected product for POS eligibility
        foreach (var selection in request.SelectedProducts)
        {
            if (!products.TryGetValue(selection.ProductId, out var product))
                throw new KeyNotFoundException($"Product {selection.ProductId} not found.");

            if (!product.Status)
                throw new ArgumentException($"Product '{product.Name}' is not active.");

            if (product.Quantity < 1)
                throw new ArgumentException($"Product '{product.Name}' is out of stock.");

            if (product.Quantity < selection.Quantity)
                throw new InvalidOperationException(
                    $"Insufficient stock for '{product.Name}'. Available: {product.Quantity}, requested: {selection.Quantity}.");
        }

        // Write header + sub-items atomically
        await using var txn = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // Bundle header row — no product, carries the bundle price
            var header = new PosCart
            {
                UserId          = userId,
                ProductId       = null,
                Quantity        = 1,          // one bundle instance
                IsBundleHeader  = true,
                ProductBundleId = bundle.Id,
                CreatedAt       = DateTime.UtcNow,
                UpdatedAt       = DateTime.UtcNow,
            };
            db.PosCarts.Add(header);
            await db.SaveChangesAsync(ct); // get the header Id

            // Bundle sub-item rows — one per selected product line
            foreach (var selection in request.SelectedProducts)
            {
                db.PosCarts.Add(new PosCart
                {
                    UserId                = userId,
                    ProductId             = selection.ProductId,
                    Quantity              = selection.Quantity,
                    IsBundleHeader        = false,
                    BundleHeaderPosCartId = header.Id,
                    BundleStepId          = selection.BundleStepId,
                    CreatedAt             = DateTime.UtcNow,
                    UpdatedAt             = DateTime.UtcNow,
                });
            }

            await db.SaveChangesAsync(ct);
            await txn.CommitAsync(ct);
        }
        catch
        {
            await txn.RollbackAsync(ct);
            throw;
        }

        return await GetAsync(userId, ct);
    }

    // ── RemoveBundleAsync ─────────────────────────────────────────────────────
    public async Task<List<CartItemDto>> RemoveBundleAsync(
        int userId,
        int bundleHeaderCartItemId,
        CancellationToken ct = default)
    {
        // Verify header ownership
        var header = await db.PosCarts
            .FirstOrDefaultAsync(c => c.Id == bundleHeaderCartItemId
                                   && c.UserId == userId
                                   && c.IsBundleHeader, ct)
            ?? throw new KeyNotFoundException("Bundle cart item not found.");

        // Load all sub-items belonging to this header
        var subItems = await db.PosCarts
            .Where(c => c.BundleHeaderPosCartId == bundleHeaderCartItemId)
            .ToListAsync(ct);

        // Remove sub-items first, then the header
        db.PosCarts.RemoveRange(subItems);
        db.PosCarts.Remove(header);
        await db.SaveChangesAsync(ct);

        return await GetAsync(userId, ct);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Validates step-based bundle selections: each selection's BundleStepId matches a valid step,
    /// the product is in that step's eligible list, and per-step quantity constraints are met.
    /// </summary>
    private static void ValidateStepSelections(
        ProductBundle bundle,
        List<BundleProductSelection> selections)
    {
        var stepLookup = bundle.Steps.ToDictionary(s => s.Id);

        // Build a lookup of eligible product IDs per step
        var eligibleProductsByStep = bundle.Steps.ToDictionary(
            s => s.Id,
            s => s.StepProducts.Select(sp => sp.ProductId).ToHashSet());

        // Validate each selection has a valid BundleStepId
        foreach (var selection in selections)
        {
            if (selection.BundleStepId is null)
                throw new ArgumentException(
                    $"Product {selection.ProductId}: BundleStepId is required for step-based bundles.");

            if (!stepLookup.ContainsKey(selection.BundleStepId.Value))
                throw new ArgumentException(
                    $"Product {selection.ProductId}: BundleStepId {selection.BundleStepId} does not belong to this bundle.");

            if (!eligibleProductsByStep[selection.BundleStepId.Value].Contains(selection.ProductId))
                throw new ArgumentException(
                    $"Product {selection.ProductId} is not eligible for step '{stepLookup[selection.BundleStepId.Value].Label}'.");
        }

        // Validate per-step quantity constraints
        var selectionsByStep = selections.GroupBy(s => s.BundleStepId!.Value);
        var stepsWithSelections = selectionsByStep.ToDictionary(g => g.Key, g => g.Sum(s => s.Quantity));

        foreach (var step in bundle.Steps)
        {
            var stepQuantity = stepsWithSelections.GetValueOrDefault(step.Id, 0);

            if (stepQuantity < step.MinQuantity)
                throw new ArgumentException(
                    $"Step '{step.Label}': selected quantity ({stepQuantity}) is below the minimum ({step.MinQuantity}).");

            if (stepQuantity > step.MaxQuantity)
                throw new ArgumentException(
                    $"Step '{step.Label}': selected quantity ({stepQuantity}) exceeds the maximum ({step.MaxQuantity}).");
        }
    }

    private static CartItemDto MapToDto(PosCart c) => new()
    {
        Id              = c.Id,
        ProductId       = c.ProductId ?? 0,
        ProductName     = c.Product?.Name ?? c.ProductBundle?.Name ?? string.Empty,
        ProductSku      = c.Product?.Sku ?? string.Empty,
        ProductImage    = c.Product?.Image,
        Quantity        = c.Quantity,
        Price           = c.Product?.Price ?? c.ProductBundle?.Price ?? 0m,
        DiscountedPrice = c.Product?.DiscountedPrice ?? c.ProductBundle?.Price ?? 0m,
        StockQuantity   = c.Product?.Quantity ?? 0,
        RowTotal        = c.Product is not null
            ? Math.Round(c.Product.DiscountedPrice * c.Quantity, 2)
            : Math.Round((c.ProductBundle?.Price ?? 0m) * c.Quantity, 2),
        IsBundleHeader        = c.IsBundleHeader,
        BundleHeaderPosCartId = c.BundleHeaderPosCartId,
        ProductBundleId       = c.ProductBundleId,
        BundleStepId          = c.BundleStepId,
        BundleStepLabel       = c.BundleStep?.Label,
    };
}
