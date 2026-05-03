using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Purchases;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class PurchaseService(AppDbContext db, IMapper mapper, IAssemblyService assemblyService) : IPurchaseService
{
    // ── GetAllAsync ────────────────────────────────────────────────────────────
    public async Task<(IEnumerable<PurchaseSummaryDto> Items, int TotalCount)> GetAllAsync(
        string? search,
        int? supplierId,
        DateTime? dateFrom,
        DateTime? dateTo,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        IQueryable<Purchase> query = db.Purchases
            .AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.PaymentMethod);

        // Search by purchase ID or supplier name
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            if (int.TryParse(term, out var purchaseId))
                query = query.Where(p => p.Id == purchaseId);
            else
                query = query.Where(p => p.Supplier.Name.ToLower().Contains(term));
        }

        // Supplier filter
        if (supplierId.HasValue)
            query = query.Where(p => p.SupplierId == supplierId.Value);

        // Date range filter on Purchase.Date (business date, not CreatedAt)
        if (dateFrom.HasValue)
            query = query.Where(p => p.Date >= dateFrom.Value.ToUniversalTime());

        if (dateTo.HasValue)
        {
            var endOfDay = dateTo.Value.ToUniversalTime().Date.AddDays(1).AddTicks(-1);
            query = query.Where(p => p.Date <= endOfDay);
        }

        var totalCount = await query.CountAsync(ct);

        var purchases = await query
            .OrderByDescending(p => p.Date)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (mapper.Map<List<PurchaseSummaryDto>>(purchases), totalCount);
    }

    // ── GetByIdAsync ───────────────────────────────────────────────────────────
    public async Task<PurchaseDetailDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var purchase = await db.Purchases
            .AsNoTracking()
            .Include(p => p.Supplier)
            .Include(p => p.User)
            .Include(p => p.PaymentMethod)
            .Include(p => p.PurchaseItems)
                .ThenInclude(pi => pi.Product)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        return purchase is null ? null : mapper.Map<PurchaseDetailDto>(purchase);
    }

    // ── CreateOrUpdateAsync ────────────────────────────────────────────────────
    public async Task<PurchaseCreateResult> CreateOrUpdateAsync(
        CreateOrUpdatePurchaseRequest request,
        int? userId,
        CancellationToken ct = default)
    {
        // Guard: totals and products are required
        if (request.Totals is null)
            throw new ArgumentException("Purchase totals are required.");
        if (request.Products is null || request.Products.Count == 0)
            throw new ArgumentException("At least one product line is required.");
        if (request.SupplierId <= 0)
            throw new ArgumentException("A valid supplier is required.");

        // Guard: no duplicate products in the same purchase request
        ValidateNoDuplicateProducts(request.Products);

        if (request.PurchaseId.HasValue)
        {
            var updatedPurchase = await UpdateAsync(request, userId, ct);
            return new PurchaseCreateResult { Purchase = updatedPurchase };
        }
        else
        {
            return await CreateAsync(request, userId, ct);
        }
    }

    // ── DeleteAsync ────────────────────────────────────────────────────────────
    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var purchase = await db.Purchases
            .Include(p => p.PurchaseItems)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new KeyNotFoundException($"Purchase {id} not found.");

        using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // Batch-load all affected products in one query to avoid N+1
            var productIds = purchase.PurchaseItems.Select(i => i.ProductId).ToList();
            var products = await db.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            // Reverse stock for all items before deletion
            foreach (var item in purchase.PurchaseItems)
            {
                if (products.TryGetValue(item.ProductId, out var product))
                {
                    product.Quantity  -= item.Quantity;
                    product.UpdatedAt  = DateTime.UtcNow;
                }
            }

            db.Purchases.Remove(purchase);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    // ── CreateAsync (private) ──────────────────────────────────────────────────
    private async Task<PurchaseCreateResult> CreateAsync(
        CreateOrUpdatePurchaseRequest request,
        int? userId,
        CancellationToken ct)
    {
        using var tx = await db.Database.BeginTransactionAsync(ct);

        try
        {
            // Resolve payment method to determine cash vs. auto-fill
            var pm = request.PaymentMethodId.HasValue
                ? await db.PaymentMethods.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == request.PaymentMethodId.Value && p.IsActive, ct)
                : null;

            bool isCashPayment = !(pm?.AutoFillAmount ?? false);

            var (roundingEnabled, roundingQuantum) = await GetPurchaseRoundingSettingsAsync(ct);

            decimal roundingAdjustment = 0m;
            decimal roundedTotal       = request.Totals.GrandTotal;

            if (roundingEnabled && isCashPayment)
                (roundedTotal, roundingAdjustment) = ApplyPurchaseCashRounding(request.Totals.GrandTotal, roundingQuantum);

            // If the payment method has AutoFillAmount = true (card/bank), the purchase
            // is considered fully paid immediately; otherwise the full amount is outstanding.
            bool isFullyPaid = pm?.AutoFillAmount ?? false;
            decimal amountPaid = isFullyPaid ? roundedTotal : 0m;
            decimal amountDue  = roundedTotal - amountPaid;

            var purchase = new Purchase
            {
                SupplierId         = request.SupplierId,
                UserId             = userId,
                Date               = request.Date.HasValue ? request.Date.Value.ToUniversalTime() : DateTime.UtcNow,
                SubTotal           = request.Totals.SubTotal,
                Tax                = request.Totals.Tax,
                Discount           = request.Totals.Discount,
                DiscountType       = request.Totals.DiscountType,
                Shipping           = request.Totals.Shipping,
                GrandTotal         = request.Totals.GrandTotal,
                RoundingAdjustment = roundingAdjustment,
                RoundedTotal       = roundedTotal,
                AmountPaid         = amountPaid,
                AmountDue          = amountDue,
                Status             = 1,
                PaymentMethodId    = request.PaymentMethodId,
                Note               = request.Note,
                CreatedAt          = DateTime.UtcNow,
                UpdatedAt          = DateTime.UtcNow,
            };

            db.Purchases.Add(purchase);
            await db.SaveChangesAsync(ct);

            // Record an initial payment transaction when the method auto-fills the amount
            if (isFullyPaid && pm is not null && roundedTotal > 0)
            {
                db.PurchaseTransactions.Add(new PurchaseTransaction
                {
                    PurchaseId      = purchase.Id,
                    SupplierId      = purchase.SupplierId,
                    UserId          = userId,
                    Amount          = roundedTotal,
                    PaidBy          = pm.Name.ToLower(),
                    PaymentMethodId = pm.Id,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow,
                });
                await db.SaveChangesAsync(ct);
            }

            // Batch-load all products for this purchase in one query to avoid N+1
            var createProductIds = request.Products.Select(l => l.Id).ToList();
            var createProductsDict = await db.Products
                .Where(p => createProductIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            foreach (var line in request.Products)
            {
                if (!createProductsDict.TryGetValue(line.Id, out var product))
                    throw new KeyNotFoundException($"Product {line.Id} not found.");

                db.PurchaseItems.Add(new PurchaseItem
                {
                    PurchaseId    = purchase.Id,
                    ProductId     = line.Id,
                    PurchasePrice = line.PurchasePrice,
                    Price         = line.Price,
                    Quantity      = line.Qty,
                    CreatedAt     = DateTime.UtcNow,
                    UpdatedAt     = DateTime.UtcNow,
                });

                product.Quantity  += line.Qty;
                product.UpdatedAt  = DateTime.UtcNow;
            }

            await db.SaveChangesAsync(ct);

            // Trigger auto-assembly for any product with AutoAssemblyTemplateId set.
            // This runs within the same transaction so both purchase and assembly are atomic.
            var autoResults = await assemblyService.TriggerAutoAssemblyForPurchaseAsync(purchase.Id, userId, ct);

            await tx.CommitAsync(ct);

            var purchaseDto = (await GetByIdAsync(purchase.Id, ct))!;
            var autoAssemblies = autoResults.Select(r => new AutoAssemblyInfo
            {
                TemplateName   = r.TemplateName,
                OutputProduct  = r.OutputProduct,
                OutputQuantity = r.OutputQuantity,
            }).ToList();

            var assemblyWarnings = autoResults.SelectMany(r => r.Warnings).ToList();

            return new PurchaseCreateResult
            {
                Purchase         = purchaseDto,
                AutoAssemblies   = autoAssemblies,
                AssemblyWarnings = assemblyWarnings,
            };
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    // ── UpdateAsync (private) ──────────────────────────────────────────────────
    private async Task<PurchaseDetailDto> UpdateAsync(   // still returns PurchaseDetailDto; wrapped by caller
        CreateOrUpdatePurchaseRequest request,
        int? userId,
        CancellationToken ct)
    {
        // Transaction wraps the load so the entity is inside the transaction scope
        using var tx = await db.Database.BeginTransactionAsync(ct);

        try
        {
            var purchase = await db.Purchases
                .Include(p => p.PurchaseItems)
                .FirstOrDefaultAsync(p => p.Id == request.PurchaseId!.Value, ct)
                ?? throw new KeyNotFoundException($"Purchase {request.PurchaseId} not found.");

            // Update header fields — preserve original UserId (creator attribution)
            purchase.SupplierId      = request.SupplierId;
            purchase.Date            = request.Date.HasValue ? request.Date.Value.ToUniversalTime() : purchase.Date;
            purchase.SubTotal        = request.Totals.SubTotal;
            purchase.Tax             = request.Totals.Tax;
            purchase.Discount        = request.Totals.Discount;
            purchase.DiscountType    = request.Totals.DiscountType;
            purchase.Shipping        = request.Totals.Shipping;
            purchase.GrandTotal      = request.Totals.GrandTotal;
            purchase.PaymentMethodId = request.PaymentMethodId;
            purchase.Note            = request.Note;
            purchase.UpdatedAt       = DateTime.UtcNow;

            // Rounding adjustment for update
            var pmUpdate = request.PaymentMethodId.HasValue
                ? await db.PaymentMethods.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == request.PaymentMethodId.Value && p.IsActive, ct)
                : null;

            bool isCashUpdate = !(pmUpdate?.AutoFillAmount ?? false);

            var (roundingEnabledUpd, roundingQuantumUpd) = await GetPurchaseRoundingSettingsAsync(ct);

            purchase.RoundingAdjustment = 0m;
            purchase.RoundedTotal       = request.Totals.GrandTotal;

            if (roundingEnabledUpd && isCashUpdate)
                (purchase.RoundedTotal, purchase.RoundingAdjustment) =
                    ApplyPurchaseCashRounding(request.Totals.GrandTotal, roundingQuantumUpd);

            // Determine which existing items were removed by the user
            // (present in DB but absent from the incoming request)
            var sentItemIds = request.Products
                .Where(l => l.ItemId.HasValue && l.ItemId.Value > 0)
                .Select(l => l.ItemId!.Value)
                .ToHashSet();

            var removedItems = purchase.PurchaseItems
                .Where(pi => !sentItemIds.Contains(pi.Id))
                .ToList();

            // Batch-load all products needed for this update in one query to avoid N+1.
            // Covers both removed items and all incoming request product lines.
            var allProductIds = removedItems.Select(r => r.ProductId)
                .Concat(request.Products.Select(l => l.Id))
                .Distinct()
                .ToList();

            var productsDict = await db.Products
                .Where(p => allProductIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            // Reverse stock for removed items and delete their rows
            foreach (var removed in removedItems)
            {
                if (productsDict.TryGetValue(removed.ProductId, out var removedProduct))
                {
                    removedProduct.Quantity  -= removed.Quantity;
                    removedProduct.UpdatedAt  = DateTime.UtcNow;
                }
                db.PurchaseItems.Remove(removed);
            }

            // Process each product line (edit existing or add new)
            foreach (var line in request.Products)
            {
                if (!productsDict.TryGetValue(line.Id, out var product))
                    throw new KeyNotFoundException($"Product {line.Id} not found.");

                if (line.ItemId.HasValue && line.ItemId.Value > 0)
                {
                    // Edit an existing purchase item
                    var existingItem = purchase.PurchaseItems
                        .FirstOrDefault(pi => pi.Id == line.ItemId.Value)
                        ?? throw new KeyNotFoundException(
                            $"PurchaseItem {line.ItemId.Value} not found on purchase {purchase.Id}.");

                    int oldQty = existingItem.Quantity;

                    existingItem.PurchasePrice = line.PurchasePrice;
                    existingItem.Price         = line.Price;
                    existingItem.Quantity      = line.Qty;
                    existingItem.UpdatedAt     = DateTime.UtcNow;

                    // Net stock adjustment: remove old qty, add new qty
                    product.Quantity  = product.Quantity - oldQty + line.Qty;
                    product.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    // New item added during edit
                    db.PurchaseItems.Add(new PurchaseItem
                    {
                        PurchaseId    = purchase.Id,
                        ProductId     = line.Id,
                        PurchasePrice = line.PurchasePrice,
                        Price         = line.Price,
                        Quantity      = line.Qty,
                        CreatedAt     = DateTime.UtcNow,
                        UpdatedAt     = DateTime.UtcNow,
                    });

                    product.Quantity  += line.Qty;
                    product.UpdatedAt  = DateTime.UtcNow;
                }
            }

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return (await GetByIdAsync(purchase.Id, ct))!;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    // ── CollectPurchaseDueAsync ────────────────────────────────────────────────
    public async Task CollectPurchaseDueAsync(
        int purchaseId,
        PurchasePaymentRequest request,
        int? userId,
        CancellationToken ct = default)
    {
        if (request.Amount <= 0)
            throw new ArgumentException("Payment amount must be greater than zero.");

        var purchase = await db.Purchases
            .FirstOrDefaultAsync(p => p.Id == purchaseId, ct)
            ?? throw new KeyNotFoundException($"Purchase {purchaseId} not found.");

        if (purchase.AmountDue <= 0)
            throw new InvalidOperationException(
                "This purchase has no outstanding balance. No further payment can be recorded.");

        if (request.Amount > purchase.AmountDue)
            throw new ArgumentException(
                $"Payment amount ({request.Amount}) cannot exceed the outstanding due ({purchase.AmountDue}).");

        // Resolve payment method
        PaymentMethod? paymentMethod = null;
        if (request.PaymentMethodId.HasValue)
        {
            paymentMethod = await db.PaymentMethods
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.Id == request.PaymentMethodId.Value && pm.IsActive, ct)
                ?? throw new ArgumentException("Invalid or inactive payment method.");
        }

        db.PurchaseTransactions.Add(new PurchaseTransaction
        {
            PurchaseId      = purchase.Id,
            SupplierId      = purchase.SupplierId,
            UserId          = userId,
            Amount          = request.Amount,
            PaidBy          = paymentMethod?.Name.ToLower() ?? "cash",
            PaymentMethodId = paymentMethod?.Id,
            Note            = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
        });

        purchase.AmountPaid += request.Amount;
        purchase.AmountDue  -= request.Amount;

        if (purchase.AmountDue < 0)
            purchase.AmountDue = 0m;

        purchase.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
    }

    // ── ValidateNoDuplicateProducts (private) ─────────────────────────────────
    private static void ValidateNoDuplicateProducts(List<PurchaseProductRequest> products)
    {
        var duplicates = products
            .GroupBy(l => l.Id)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (duplicates.Count > 0)
            throw new ArgumentException(
                $"Duplicate products in request: {string.Join(", ", duplicates)}. Each product may only appear once per purchase.");
    }

    // ── Purchase rounding helpers ──────────────────────────────────────────────
    private async Task<(bool Enabled, decimal Quantum)> GetPurchaseRoundingSettingsAsync(CancellationToken ct)
    {
        var rows = await db.Settings.AsNoTracking()
            .Where(s => s.Key == "purchase_rounding_enabled" || s.Key == "purchase_rounding_quantum")
            .ToListAsync(ct);
        bool enabled = rows.FirstOrDefault(r => r.Key == "purchase_rounding_enabled")?.Value == "true";
        decimal quantum = rows.FirstOrDefault(r => r.Key == "purchase_rounding_quantum")?.Value switch
        {
            "0.10" => 0.10m, _ => 0.05m,
        };
        return (enabled, quantum);
    }

    private static (decimal RoundedTotal, decimal Adjustment) ApplyPurchaseCashRounding(decimal total, decimal quantum)
    {
        int totalCents   = (int)Math.Round(total   * 100m, MidpointRounding.AwayFromZero);
        int quantumUnits = (int)Math.Round(quantum * 100m, MidpointRounding.AwayFromZero);
        int remainder    = totalCents % quantumUnits;
        int roundedCents = remainder * 2 < quantumUnits
            ? totalCents - remainder
            : totalCents + (quantumUnits - remainder);
        decimal roundedTotal = roundedCents / 100m;
        return (roundedTotal, roundedTotal - total);
    }
}
