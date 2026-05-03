using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Assembly;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class AssemblyService(AppDbContext db, IMapper mapper) : IAssemblyService
{
    // ═══════════════════════════════════════════════════════════════════════════
    // Assembly Templates
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<(IEnumerable<AssemblyTemplateSummaryDto> Items, int TotalCount)> GetTemplatesAsync(
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = db.AssemblyTemplates
            .AsNoTracking()
            .Include(t => t.OutputProduct)
            .Include(t => t.Items)
            .OrderByDescending(t => t.CreatedAt);

        var totalCount = await query.CountAsync(ct);

        var templates = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (mapper.Map<List<AssemblyTemplateSummaryDto>>(templates), totalCount);
    }

    public async Task<AssemblyTemplateDetailDto?> GetTemplateByIdAsync(int id, CancellationToken ct = default)
    {
        var template = await db.AssemblyTemplates
            .AsNoTracking()
            .Include(t => t.OutputProduct)
            .Include(t => t.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

        return template is null ? null : mapper.Map<AssemblyTemplateDetailDto>(template);
    }

    public async Task<AssemblyTemplateDetailDto> CreateTemplateAsync(
        CreateAssemblyTemplateRequest request,
        CancellationToken ct = default)
    {
        ValidateTemplateRequest(request.Name, request.AssemblyType, request.DefaultYield, request.Items);

        // Verify output product exists
        if (!await db.Products.AnyAsync(p => p.Id == request.OutputProductId, ct))
            throw new ArgumentException("Output product not found.");

        // Guard: circular assembly (output product cannot also be an ingredient)
        var inputProductIds = request.Items.Select(i => i.ProductId).ToHashSet();
        if (inputProductIds.Contains(request.OutputProductId))
            throw new ArgumentException("A product cannot be both an input and output of the same assembly.");

        // Guard: all ingredient products must exist
        foreach (var item in request.Items)
        {
            if (!await db.Products.AnyAsync(p => p.Id == item.ProductId, ct))
                throw new ArgumentException($"Ingredient product {item.ProductId} not found.");
        }

        var template = new AssemblyTemplate
        {
            Name = request.Name.Trim(),
            AssemblyType = request.AssemblyType.ToLower(),
            OutputProductId = request.OutputProductId,
            DefaultYield = request.DefaultYield,
            Description = request.Description?.Trim(),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.AssemblyTemplates.Add(template);
        await db.SaveChangesAsync(ct);

        foreach (var item in request.Items)
        {
            db.AssemblyTemplateItems.Add(new AssemblyTemplateItem
            {
                AssemblyTemplateId = template.Id,
                ProductId = item.ProductId,
                DefaultQuantity = item.DefaultQuantity,
                SortOrder = item.SortOrder,
            });
        }

        await db.SaveChangesAsync(ct);

        return (await GetTemplateByIdAsync(template.Id, ct))!;
    }

    public async Task<AssemblyTemplateDetailDto> UpdateTemplateAsync(
        int id,
        UpdateAssemblyTemplateRequest request,
        CancellationToken ct = default)
    {
        ValidateTemplateRequest(request.Name, request.AssemblyType, request.DefaultYield, request.Items);

        var template = await db.AssemblyTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException("Assembly template not found.");

        // Verify output product exists
        if (!await db.Products.AnyAsync(p => p.Id == request.OutputProductId, ct))
            throw new ArgumentException("Output product not found.");

        // Guard: circular assembly
        var inputProductIds = request.Items.Select(i => i.ProductId).ToHashSet();
        if (inputProductIds.Contains(request.OutputProductId))
            throw new ArgumentException("A product cannot be both an input and output of the same assembly.");

        // Guard: all ingredient products must exist
        foreach (var item in request.Items)
        {
            if (!await db.Products.AnyAsync(p => p.Id == item.ProductId, ct))
                throw new ArgumentException($"Ingredient product {item.ProductId} not found.");
        }

        template.Name = request.Name.Trim();
        template.AssemblyType = request.AssemblyType.ToLower();
        template.OutputProductId = request.OutputProductId;
        template.DefaultYield = request.DefaultYield;
        template.Description = request.Description?.Trim();
        template.IsActive = request.IsActive;
        template.UpdatedAt = DateTime.UtcNow;

        // Replace items: remove all existing, re-add from request
        db.AssemblyTemplateItems.RemoveRange(template.Items);

        foreach (var item in request.Items)
        {
            db.AssemblyTemplateItems.Add(new AssemblyTemplateItem
            {
                AssemblyTemplateId = template.Id,
                ProductId = item.ProductId,
                DefaultQuantity = item.DefaultQuantity,
                SortOrder = item.SortOrder,
            });
        }

        await db.SaveChangesAsync(ct);

        return (await GetTemplateByIdAsync(id, ct))!;
    }

    public async Task DeleteTemplateAsync(int id, CancellationToken ct = default)
    {
        var template = await db.AssemblyTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException("Assembly template not found.");

        // Soft constraint: warn if any assembly records reference this template
        var assemblyCount = await db.StockAssemblies.CountAsync(a => a.AssemblyTemplateId == id, ct);
        if (assemblyCount > 0)
            throw new InvalidOperationException(
                $"This template has {assemblyCount} assembly record(s). Deleting it would orphan those records. " +
                "Deactivate the template instead, or delete the associated assembly records first.");

        // Remove items first (SQLite cascade is unreliable without explicit config)
        db.AssemblyTemplateItems.RemoveRange(template.Items);
        db.AssemblyTemplates.Remove(template);
        await db.SaveChangesAsync(ct);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Stock Assemblies
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<(IEnumerable<StockAssemblySummaryDto> Items, int TotalCount)> GetAssembliesAsync(
        int page,
        int pageSize,
        DateTime? dateFrom,
        DateTime? dateTo,
        string? assemblyType,
        int? outputProductId,
        string? triggeredBy,
        CancellationToken ct = default)
    {
        IQueryable<StockAssembly> query = db.StockAssemblies
            .AsNoTracking()
            .Include(a => a.OutputProduct)
            .Include(a => a.User);

        if (!string.IsNullOrWhiteSpace(assemblyType))
            query = query.Where(a => a.AssemblyType == assemblyType.ToLower());

        if (outputProductId.HasValue)
            query = query.Where(a => a.OutputProductId == outputProductId.Value);

        if (!string.IsNullOrWhiteSpace(triggeredBy))
            query = query.Where(a => a.TriggeredBy == triggeredBy.ToLower());

        if (dateFrom.HasValue)
            query = query.Where(a => a.AssembledAt >= dateFrom.Value.ToUniversalTime());

        if (dateTo.HasValue)
        {
            var endOfDay = dateTo.Value.ToUniversalTime().Date.AddDays(1).AddTicks(-1);
            query = query.Where(a => a.AssembledAt <= endOfDay);
        }

        var totalCount = await query.CountAsync(ct);

        var assemblies = await query
            .OrderByDescending(a => a.AssembledAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (mapper.Map<List<StockAssemblySummaryDto>>(assemblies), totalCount);
    }

    public async Task<StockAssemblyDetailDto?> GetAssemblyByIdAsync(int id, CancellationToken ct = default)
    {
        var assembly = await db.StockAssemblies
            .AsNoTracking()
            .Include(a => a.AssemblyTemplate)
            .Include(a => a.OutputProduct)
            .Include(a => a.User)
            .Include(a => a.Items)
                .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(a => a.Id == id, ct);

        return assembly is null ? null : mapper.Map<StockAssemblyDetailDto>(assembly);
    }

    public async Task<CreateStockAssemblyResponse> CreateAssemblyAsync(
        CreateStockAssemblyRequest request,
        int? userId,
        CancellationToken ct = default)
    {
        // Validation
        if (request.OutputQuantity <= 0)
            throw new ArgumentException("Output quantity must be greater than zero.");

        if (request.Items.Count == 0)
            throw new ArgumentException("At least one ingredient is required.");

        if (!new[] { "split", "production" }.Contains(request.AssemblyType.ToLower()))
            throw new ArgumentException("Assembly type must be 'split' or 'production'.");

        foreach (var item in request.Items)
        {
            if (item.QuantityUsed <= 0)
                throw new ArgumentException("Ingredient quantity must be greater than zero.");
            if (item.WasteQuantity < 0)
                throw new ArgumentException("Waste quantity cannot be negative.");
        }

        // Validate optional template reference
        if (request.AssemblyTemplateId.HasValue
            && !await db.AssemblyTemplates.AnyAsync(t => t.Id == request.AssemblyTemplateId.Value, ct))
            throw new ArgumentException("Assembly template not found.");

        // Load output product
        var outputProduct = await db.Products.FirstOrDefaultAsync(p => p.Id == request.OutputProductId, ct)
            ?? throw new ArgumentException("Output product not found.");

        // Guard: output product cannot also be an ingredient
        if (request.Items.Any(i => i.ProductId == request.OutputProductId))
            throw new ArgumentException("A product cannot be both an input and output of the same assembly.");

        var warnings = new List<string>();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            var assemblyItems = new List<StockAssemblyItem>();
            decimal totalInputCost = 0m;

            foreach (var lineRequest in request.Items)
            {
                var product = await db.Products.FirstOrDefaultAsync(p => p.Id == lineRequest.ProductId, ct)
                    ?? throw new ArgumentException($"Ingredient product {lineRequest.ProductId} not found.");

                var totalDeducted = lineRequest.QuantityUsed + lineRequest.WasteQuantity;

                // Warn if insufficient stock (but proceed)
                if (product.Quantity < (int)Math.Ceiling((double)totalDeducted))
                {
                    warnings.Add(
                        $"Insufficient stock: '{product.Name}' requires {totalDeducted} but only {product.Quantity} available. Assembly proceeded anyway.");
                }

                var lineCost = totalDeducted * product.PurchasePrice;
                totalInputCost += lineCost;

                // Deduct ingredient stock
                product.Quantity -= (int)Math.Ceiling((double)totalDeducted);
                product.UpdatedAt = DateTime.UtcNow;

                assemblyItems.Add(new StockAssemblyItem
                {
                    ProductId = lineRequest.ProductId,
                    QuantityUsed = lineRequest.QuantityUsed,
                    WasteQuantity = lineRequest.WasteQuantity,
                    UnitCostAtTime = product.PurchasePrice,
                });
            }

            // Compute cost per output unit
            var costPerUnit = request.OutputQuantity > 0
                ? Math.Round(totalInputCost / request.OutputQuantity, 4)
                : 0m;

            // Add output stock and update purchase price
            outputProduct.Quantity += (int)Math.Ceiling((double)request.OutputQuantity);
            outputProduct.PurchasePrice = costPerUnit;
            outputProduct.UpdatedAt = DateTime.UtcNow;

            var assembly = new StockAssembly
            {
                AssemblyTemplateId = request.AssemblyTemplateId,
                AssemblyType = request.AssemblyType.ToLower(),
                OutputProductId = request.OutputProductId,
                OutputQuantity = request.OutputQuantity,
                OutputCostPerUnit = costPerUnit,
                Note = request.Note?.Trim(),
                TriggeredBy = "manual",
                UserId = userId,
                AssembledAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            db.StockAssemblies.Add(assembly);
            await db.SaveChangesAsync(ct);

            // Attach items now that assembly.Id is populated
            foreach (var item in assemblyItems)
            {
                item.StockAssemblyId = assembly.Id;
                db.StockAssemblyItems.Add(item);
            }

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            var dto = (await GetAssemblyByIdAsync(assembly.Id, ct))!;
            return new CreateStockAssemblyResponse { Assembly = dto, Warnings = warnings };
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<List<string>> DeleteAssemblyAsync(int id, CancellationToken ct = default)
    {
        var assembly = await db.StockAssemblies
            .Include(a => a.Items)
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new KeyNotFoundException("Assembly record not found.");

        var warnings = new List<string>();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // Restore ingredient stocks
            foreach (var item in assembly.Items)
            {
                var product = await db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
                if (product is not null)
                {
                    var totalDeducted = item.QuantityUsed + item.WasteQuantity;
                    product.Quantity += (int)Math.Ceiling((double)totalDeducted);
                    product.UpdatedAt = DateTime.UtcNow;
                }
            }

            // Deduct output stock
            var outputProduct = await db.Products.FirstOrDefaultAsync(p => p.Id == assembly.OutputProductId, ct);
            if (outputProduct is not null)
            {
                var newQty = outputProduct.Quantity - (int)Math.Ceiling((double)assembly.OutputQuantity);
                if (newQty < 0)
                {
                    warnings.Add(
                        $"Reversing this assembly reduced '{outputProduct.Name}' stock below zero " +
                        $"(new quantity: {newQty}). This may indicate some output has already been sold.");
                }
                outputProduct.Quantity = newQty;
                outputProduct.UpdatedAt = DateTime.UtcNow;
                // Note: PurchasePrice is NOT reverted on deletion (documented limitation — prior price not snapshotted)
            }

            // Remove assembly items then the assembly itself
            db.StockAssemblyItems.RemoveRange(assembly.Items);
            db.StockAssemblies.Remove(assembly);

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return warnings;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Auto-Assembly triggered by Purchase
    // ═══════════════════════════════════════════════════════════════════════════

    public async Task<List<AutoAssemblyResult>> TriggerAutoAssemblyForPurchaseAsync(
        int purchaseId,
        int? userId,
        CancellationToken ct = default)
    {
        var results = new List<AutoAssemblyResult>();

        // ── Step 1: Load purchase items ───────────────────────────────────────
        // Load as tracked because we will mutate product quantities below.
        var purchaseItems = await db.PurchaseItems
            .Where(pi => pi.PurchaseId == purchaseId)
            .ToListAsync(ct);

        if (purchaseItems.Count == 0)
            return results;

        // ── Step 2: Batch-load the products referenced by purchase items ──────
        var purchaseProductIds = purchaseItems.Select(pi => pi.ProductId).Distinct().ToList();

        var purchaseProducts = await db.Products
            .Where(p => purchaseProductIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        // Collect only those products that have an auto-assembly template
        var templateIds = purchaseProducts.Values
            .Where(p => p.AutoAssemblyTemplateId.HasValue)
            .Select(p => p.AutoAssemblyTemplateId!.Value)
            .Distinct()
            .ToList();

        if (templateIds.Count == 0)
            return results;

        // ── Step 3: Batch-load active templates with their items in one query ─
        var templateMap = await db.AssemblyTemplates
            .Include(t => t.Items)
            .Where(t => templateIds.Contains(t.Id) && t.IsActive)
            .ToDictionaryAsync(t => t.Id, ct);

        // ── Step 4: Batch-load all ingredient + output products needed ─────────
        // Collect every product ID referenced by any template item, plus every output product.
        var ingredientAndOutputIds = templateMap.Values
            .SelectMany(t => t.Items.Select(i => i.ProductId).Append(t.OutputProductId))
            .Distinct()
            .ToList();

        // Merge with already-loaded purchase products to avoid double-tracking.
        // Load only those not already in the EF change tracker.
        var alreadyTrackedIds = purchaseProducts.Keys.ToHashSet();
        var idsToLoad = ingredientAndOutputIds.Where(id => !alreadyTrackedIds.Contains(id)).ToList();

        var extraProducts = idsToLoad.Count > 0
            ? await db.Products
                .Where(p => idsToLoad.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct)
            : new Dictionary<int, Product>();

        // Build a unified lookup dictionary (merge the two sets)
        var productMap = purchaseProducts
            .Concat(extraProducts)
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        // ── Step 5: Process each purchase item using only in-memory lookups ───
        var allAssemblyItems = new List<(StockAssembly Assembly, List<StockAssemblyItem> Items)>();

        foreach (var purchaseItem in purchaseItems)
        {
            if (!purchaseProducts.TryGetValue(purchaseItem.ProductId, out var product))
                continue;

            if (product.AutoAssemblyTemplateId == null)
                continue;

            if (!templateMap.TryGetValue(product.AutoAssemblyTemplateId.Value, out var template))
                continue; // Template missing or inactive — skip silently per PRD section 15

            var result = new AutoAssemblyResult
            {
                TemplateName = template.Name,
                OutputProduct = string.Empty,
            };

            // Compute scale factor: how many template "runs" does the purchase quantity represent?
            var templateInputQty = template.Items.Count > 0
                ? template.Items.First().DefaultQuantity
                : 1m;

            var scaleFactor = templateInputQty > 0
                ? purchaseItem.Quantity / templateInputQty
                : 1m;

            var scaledOutputQty = Math.Round(scaleFactor * template.DefaultYield, 4);

            if (!productMap.TryGetValue(template.OutputProductId, out var outputProduct))
                continue;

            result.OutputProduct = outputProduct.Name;
            result.OutputQuantity = scaledOutputQty;

            var assemblyItems = new List<StockAssemblyItem>();
            decimal totalInputCost = 0m;

            foreach (var templateItem in template.Items)
            {
                if (!productMap.TryGetValue(templateItem.ProductId, out var ingredientProduct))
                    continue;

                var scaledIngredientQty = Math.Round(templateItem.DefaultQuantity * scaleFactor, 4);

                // Warn if insufficient stock — proceed anyway per PRD section 6.4
                if (ingredientProduct.Quantity < (int)Math.Ceiling((double)scaledIngredientQty))
                {
                    result.Warnings.Add(
                        $"Ingredient '{ingredientProduct.Name}' had insufficient stock at time of assembly " +
                        $"(required {scaledIngredientQty}, available {ingredientProduct.Quantity}).");
                }

                totalInputCost += scaledIngredientQty * ingredientProduct.PurchasePrice;

                // Deduct ingredient stock (in-memory; flushed in the single SaveChanges below)
                ingredientProduct.Quantity -= (int)Math.Ceiling((double)scaledIngredientQty);
                ingredientProduct.UpdatedAt = DateTime.UtcNow;

                assemblyItems.Add(new StockAssemblyItem
                {
                    ProductId = ingredientProduct.Id,
                    QuantityUsed = scaledIngredientQty,
                    WasteQuantity = 0m,
                    UnitCostAtTime = ingredientProduct.PurchasePrice,
                });
            }

            var costPerUnit = scaledOutputQty > 0
                ? Math.Round(totalInputCost / scaledOutputQty, 4)
                : 0m;

            // Add output stock (in-memory)
            outputProduct.Quantity += (int)Math.Ceiling((double)scaledOutputQty);
            outputProduct.PurchasePrice = costPerUnit;
            outputProduct.UpdatedAt = DateTime.UtcNow;

            var noteText = result.Warnings.Count > 0
                ? string.Join("; ", result.Warnings)
                : null;

            var assembly = new StockAssembly
            {
                AssemblyTemplateId = template.Id,
                AssemblyType = template.AssemblyType,
                OutputProductId = template.OutputProductId,
                OutputQuantity = scaledOutputQty,
                OutputCostPerUnit = costPerUnit,
                Note = noteText,
                TriggeredBy = "purchase",
                PurchaseId = purchaseId,
                UserId = userId,
                AssembledAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };

            db.StockAssemblies.Add(assembly);
            allAssemblyItems.Add((assembly, assemblyItems));
            results.Add(result);
        }

        // ── Step 6: Flush all stock mutations + all new assembly records in one call ──
        // The first SaveChanges populates assembly.Id so we can set StockAssemblyId on items.
        if (allAssemblyItems.Count > 0)
        {
            await db.SaveChangesAsync(ct);

            foreach (var (assembly, items) in allAssemblyItems)
            {
                foreach (var item in items)
                {
                    item.StockAssemblyId = assembly.Id;
                    db.StockAssemblyItems.Add(item);
                }
            }

            await db.SaveChangesAsync(ct);
        }

        return results;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Private helpers
    // ═══════════════════════════════════════════════════════════════════════════

    private static void ValidateTemplateRequest(
        string name,
        string assemblyType,
        decimal defaultYield,
        IEnumerable<AssemblyTemplateItemRequest> items)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Template name is required.");

        if (!new[] { "split", "production" }.Contains(assemblyType?.ToLower()))
            throw new ArgumentException("Assembly type must be 'split' or 'production'.");

        if (defaultYield <= 0)
            throw new ArgumentException("Default yield must be greater than zero.");

        var itemsList = items.ToList();

        if (itemsList.Count == 0)
            throw new ArgumentException("At least one ingredient is required.");

        foreach (var item in itemsList)
        {
            if (item.DefaultQuantity <= 0)
                throw new ArgumentException("Ingredient quantity must be greater than zero.");
        }
    }
}
