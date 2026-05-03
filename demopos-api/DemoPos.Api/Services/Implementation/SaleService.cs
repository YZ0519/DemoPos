using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Constants;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Sales;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class SaleService(AppDbContext db, IMapper mapper, ITableService tableService, IVoucherService voucherService) : ISaleService
{
    // ── GetAllAsync ────────────────────────────────────────────────────────────
    public async Task<(IEnumerable<SaleSummaryDto> Items, int TotalCount)> GetAllAsync(
        string? search,
        int? status,
        DateTime? dateFrom,
        DateTime? dateTo,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        IQueryable<Sale> query = db.Sales
            .AsNoTracking()
            .Include(o => o.Customer);

        // Search by sale ID or customer name
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();

            if (int.TryParse(term, out var saleId))
            {
                query = query.Where(o => o.Id == saleId);
            }
            else
            {
                query = query.Where(o => o.Customer.Name.ToLower().Contains(term));
            }
        }

        // Status filter
        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        // Date range filter (inclusive, UTC)
        if (dateFrom.HasValue)
            query = query.Where(o => o.CreatedAt >= dateFrom.Value.ToUniversalTime());

        if (dateTo.HasValue)
        {
            // Include the full day by moving to end-of-day
            var endOfDay = dateTo.Value.ToUniversalTime().Date.AddDays(1).AddTicks(-1);
            query = query.Where(o => o.CreatedAt <= endOfDay);
        }

        var totalCount = await query.CountAsync(ct);

        var sales = await query
            .OrderByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (mapper.Map<List<SaleSummaryDto>>(sales), totalCount);
    }

    // ── GetByIdAsync ───────────────────────────────────────────────────────────
    public async Task<SaleDetailDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var sale = await db.Sales
            .AsNoTracking()
            .Include(o => o.Customer)
            .Include(o => o.User)
            .Include(o => o.Table)
            .Include(o => o.SaleItems)
                .ThenInclude(oi => oi.Product)
            .Include(o => o.SaleItems)
                .ThenInclude(oi => oi.ProductBundle)
            .Include(o => o.SaleItems)
                .ThenInclude(oi => oi.BundleStep)
            .Include(o => o.SaleTransactions)
                .ThenInclude(ot => ot.User)
            .Include(o => o.SaleTransactions)
                .ThenInclude(ot => ot.PaymentMethod)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

        return sale is null ? null : mapper.Map<SaleDetailDto>(sale);
    }

    // ── CollectDueAsync ────────────────────────────────────────────────────────
    public async Task<SaleTransactionDto> CollectDueAsync(
        int saleId,
        DueCollectionRequest request,
        int? userId,
        CancellationToken ct = default)
    {
        var sale = await db.Sales
            .FirstOrDefaultAsync(o => o.Id == saleId, ct)
            ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

        if (request.Amount <= 0)
            throw new ArgumentException("Collection amount must be greater than zero.");

        if (sale.Status == 1)
            throw new InvalidOperationException("This sale is already fully paid. No further payment can be recorded.");

        if (sale.Due <= 0)
            throw new InvalidOperationException("This sale has no outstanding balance. No further payment can be recorded.");

        if (request.Amount > sale.Due)
            throw new ArgumentException($"Collection amount ({request.Amount}) cannot exceed the outstanding due ({sale.Due}).");

        // PaidAmount is the gross cash tendered (defaults to Amount when not supplied).
        // Change = PaidAmount - Amount; PaidAmount must be >= Amount.
        decimal paidAmount = request.PaidAmount > 0 ? request.PaidAmount : request.Amount;

        if (paidAmount < request.Amount)
            throw new ArgumentException("Paid amount cannot be less than the collection amount.");

        decimal change = Math.Max(0m, paidAmount - request.Amount);

        var paymentMethod = await db.PaymentMethods
            .FirstOrDefaultAsync(pm => pm.Id == request.PaymentMethodId && pm.IsActive, ct)
            ?? throw new ArgumentException("Invalid or inactive payment method.");

        var transaction = new SaleTransaction
        {
            SaleId          = saleId,
            CustomerId      = sale.CustomerId,
            UserId          = userId,
            Amount          = request.Amount,
            Change          = change,
            PaidBy          = paymentMethod.Name.ToLower(),
            PaymentMethodId = paymentMethod.Id,
            TransactionId   = string.IsNullOrWhiteSpace(request.TransactionId)
                ? null : request.TransactionId.Trim(),
            CreatedAt  = DateTime.UtcNow,
            UpdatedAt  = DateTime.UtcNow,
        };

        db.SaleTransactions.Add(transaction);

        sale.Paid      += request.Amount;
        sale.Due       -= request.Amount;
        sale.Change     = change;
        sale.UpdatedAt  = DateTime.UtcNow;

        if (sale.Due <= 0)
        {
            sale.Due    = 0;
            sale.Status = 1; // Paid
        }

        await db.SaveChangesAsync(ct);

        // Reload with User and PaymentMethod navigations for mapping
        var saved = await db.SaleTransactions
            .AsNoTracking()
            .Include(ot => ot.User)
            .Include(ot => ot.PaymentMethod)
            .FirstAsync(ot => ot.Id == transaction.Id, ct);

        return mapper.Map<SaleTransactionDto>(saved);
    }

    // ── GetCollectionReceiptAsync ──────────────────────────────────────────────
    public async Task<SaleDetailDto?> GetCollectionReceiptAsync(
        int saleId,
        int transactionId,
        CancellationToken ct = default)
    {
        // Verify the transaction belongs to the sale
        var exists = await db.SaleTransactions
            .AsNoTracking()
            .AnyAsync(ot => ot.Id == transactionId && ot.SaleId == saleId, ct);

        if (!exists)
            return null;

        return await GetByIdAsync(saleId, ct);
    }

    // ── UpdateStatusAsync ──────────────────────────────────────────────────────
    public async Task<bool> UpdateStatusAsync(int id, int status, CancellationToken ct = default)
    {
        if (status is not (0 or 1))
            throw new ArgumentException("Status must be 0 (Due) or 1 (Paid).");

        var sale = await db.Sales
            .FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new KeyNotFoundException($"Sale {id} not found.");

        if (status == 1 && sale.Due > 0)
            throw new InvalidOperationException("Cannot mark sale as Paid while there is an outstanding due amount.");

        sale.Status    = status;
        sale.UpdatedAt = DateTime.UtcNow;

        // When voiding payment (status = 0): reset financial fields and hard-delete
        // all transaction records so that re-payment produces exactly one transaction.
        if (status == 0)
        {
            sale.Paid   = 0m;
            sale.Due    = sale.RoundedTotal;
            sale.Change = 0m;

            var transactions = await db.SaleTransactions
                .Where(t => t.SaleId == id)
                .ToListAsync(ct);

            db.SaleTransactions.RemoveRange(transactions);
        }

        await db.SaveChangesAsync(ct);
        return true;
    }

    // ── DeleteAsync ────────────────────────────────────────────────────────────
    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var sale = await db.Sales
            .Include(o => o.SaleItems)
                .ThenInclude(oi => oi.Product)
            .Include(o => o.SaleItems)
                .ThenInclude(oi => oi.ProductBundle)
            .FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new KeyNotFoundException($"Sale {id} not found.");

        // Restore stock for each line item (skips bundle headers).
        await RestoreStockForItemsAsync(sale.SaleItems, ct);

        // Release the table if this was an open dine-in order
        if (sale.TableId.HasValue && string.Equals(sale.OrderStatus, OrderStatuses.Open, StringComparison.OrdinalIgnoreCase))
            await tableService.SetStatusAsync(sale.TableId.Value, TableStatuses.Available);

        db.Sales.Remove(sale);
        await db.SaveChangesAsync(ct);

        return true;
    }

    // ── GetByCustomerAsync ─────────────────────────────────────────────────────
    public async Task<IEnumerable<SaleSummaryDto>> GetByCustomerAsync(
        int customerId,
        CancellationToken ct = default)
    {
        var customerExists = await db.Customers
            .AsNoTracking()
            .AnyAsync(c => c.Id == customerId, ct);

        if (!customerExists)
            throw new KeyNotFoundException($"Customer {customerId} not found.");

        var sales = await db.Sales
            .AsNoTracking()
            .Include(o => o.Customer)
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(ct);

        return mapper.Map<List<SaleSummaryDto>>(sales);
    }

    // ── UpdateAsync ────────────────────────────────────────────────────────────
    public async Task<SaleDetailDto> UpdateAsync(int id, UpdateSaleRequest request, CancellationToken ct = default)
    {
        if (request.Items.Count == 0)
            throw new ArgumentException("Sale must have at least one item.");

        if (request.Discount < 0)
            throw new ArgumentException("Sale discount cannot be negative.");

        var customerExists = await db.Customers
            .AsNoTracking()
            .AnyAsync(c => c.Id == request.CustomerId, ct);

        if (!customerExists)
            throw new KeyNotFoundException("Customer not found.");

        await using var txn = await db.Database.BeginTransactionAsync(ct);

        try
        {
            // Load sale + existing items + products (tracking)
            var sale = await db.Sales
                .Include(o => o.SaleItems)
                    .ThenInclude(oi => oi.Product)
                .Include(o => o.SaleItems)
                    .ThenInclude(oi => oi.ProductBundle)
                .FirstOrDefaultAsync(o => o.Id == id, ct)
                ?? throw new KeyNotFoundException($"Sale {id} not found.");

            // Step 1: Restore stock for all existing items (skips bundle headers).
            await RestoreStockForItemsAsync(sale.SaleItems, ct);

            // Step 2: Load all products needed for new items
            var newProductIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
            var products = await db.Products
                .Where(p => newProductIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            // Step 3: Build new SaleItems and decrement stock
            var originalById = sale.SaleItems.ToDictionary(i => i.Id);
            var newSaleItems = new List<SaleItem>();
            foreach (var itemReq in request.Items)
            {
                if (itemReq.Quantity <= 0)
                    throw new ArgumentException($"Quantity must be greater than zero for product {itemReq.ProductId}.");

                if (!products.TryGetValue(itemReq.ProductId, out var product))
                    throw new KeyNotFoundException($"Product {itemReq.ProductId} not found.");

                if (!product.Status)
                    throw new InvalidOperationException($"Product '{product.Name}' is not active.");

                if (product.Quantity < itemReq.Quantity)
                    throw new InvalidOperationException(
                        $"Insufficient stock for '{product.Name}'. Available: {product.Quantity}, requested: {itemReq.Quantity}.");

                var itemSubTotal = Math.Round(product.Price * itemReq.Quantity, 2);
                var itemDiscount = Math.Round((product.Price - product.DiscountedPrice) * itemReq.Quantity, 2);
                var itemTotal    = Math.Round(product.DiscountedPrice * itemReq.Quantity, 2);

                // Preserve kitchen/void/modifier state from the original item when the
                // request supplies a matching Id (admin edit of an existing line).
                SaleItem? orig = (itemReq.Id.HasValue && originalById.TryGetValue(itemReq.Id.Value, out var o)) ? o : null;

                newSaleItems.Add(new SaleItem
                {
                    ProductId        = product.Id,
                    Product          = product,
                    Quantity         = itemReq.Quantity,
                    Price            = product.DiscountedPrice,
                    PurchasePrice    = product.PurchasePrice,
                    SubTotal         = itemSubTotal,
                    Discount         = itemDiscount,
                    Total            = itemTotal,
                    // ── Preserve kitchen/void/modifier state from original item ──
                    KitchenSentAt    = orig?.KitchenSentAt,
                    IsVoided         = orig?.IsVoided ?? false,
                    VoidedAt         = orig?.VoidedAt,
                    VoidedByUserId   = orig?.VoidedByUserId,
                    ModifierNote     = orig?.ModifierNote,
                    ItemDiscount     = orig?.ItemDiscount ?? 0m,
                    ItemDiscountType = orig?.ItemDiscountType,
                    OverriddenPrice  = orig?.OverriddenPrice,
                    IsBundleHeader   = orig?.IsBundleHeader ?? false,
                    // BundleHeaderSaleItemId intentionally omitted — stale after RemoveRange
                    CreatedAt        = orig?.CreatedAt ?? DateTime.UtcNow,
                    UpdatedAt        = DateTime.UtcNow,
                });
            }

            await DeductStockForItemsAsync(newSaleItems, ct);

            // Step 4: Replace sale items
            db.SaleItems.RemoveRange(sale.SaleItems);
            sale.SaleItems = newSaleItems;

            // Step 5: Recalculate totals
            var subTotal = newSaleItems.Sum(i => i.Total);

            if (request.Discount > subTotal)
                throw new ArgumentException("Sale discount cannot exceed the sale sub-total.");

            var total = Math.Round(subTotal - request.Discount, 2);

            // Apply rounding in update mode (re-apply based on current setting; no PM context)
            var (roundingEnabled_upd, roundingQuantum_upd) = await GetRoundingSettingsAsync(ct);
            decimal roundingAdjustment = 0m;
            decimal roundedTotal = total;
            if (roundingEnabled_upd)
            {
                (roundedTotal, roundingAdjustment) = ApplyCashRounding(total, roundingQuantum_upd);
            }

            if (sale.Paid > roundedTotal)
                throw new ArgumentException("Paid amount exceeds the new rounded sale total. Reduce the discount or adjust payments first.");

            var due    = Math.Round(roundedTotal - sale.Paid, 2);
            var status = due <= 0 ? 1 : 0;

            // Step 6: Update sale fields
            sale.CustomerId         = request.CustomerId;
            sale.Note               = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
            sale.Discount           = request.Discount;
            sale.SubTotal           = subTotal;
            sale.Total              = total;
            sale.RoundingAdjustment = roundingAdjustment;
            sale.RoundedTotal       = roundedTotal;
            sale.Due                = due;
            sale.Status             = status;
            sale.OrderDate          = request.OrderDate ?? sale.OrderDate;
            sale.UpdatedAt          = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);
            await txn.CommitAsync(ct);

            return (await GetByIdAsync(sale.Id, ct))!;
        }
        catch
        {
            await txn.RollbackAsync(ct);
            throw;
        }
    }

    // ── CreateAsync ────────────────────────────────────────────────────────────
    public async Task<SaleDetailDto> CreateAsync(
        CreateSaleRequest request,
        int userId,
        CancellationToken ct = default)
    {
        // 1. Validate customer (before opening transaction — read-only check)
        var customerExists = await db.Customers
            .AsNoTracking()
            .AnyAsync(c => c.Id == request.CustomerId, ct);

        if (!customerExists)
            throw new KeyNotFoundException("Customer not found.");

        // 2. Validate discount sign early (before transaction)
        if (request.Discount < 0)
            throw new ArgumentException("Sale discount cannot be negative.");

        if (request.Paid < 0)
            throw new ArgumentException("Paid amount cannot be negative.");

        // 2b. Resolve payment method before opening the transaction (read-only).
        //     We need this early to determine isCashPayment for rounding.
        PaymentMethod? resolvedPaymentMethod = null;
        if (request.PaymentMethodId.HasValue)
        {
            resolvedPaymentMethod = await db.PaymentMethods
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.Id == request.PaymentMethodId.Value && pm.IsActive, ct)
                ?? throw new ArgumentException("Invalid or inactive payment method.");
        }
        else
        {
            resolvedPaymentMethod = await db.PaymentMethods
                .AsNoTracking()
                .Where(pm => pm.IsActive)
                .OrderByDescending(pm => pm.IsDefault)
                .ThenBy(pm => pm.SortOrder)
                .FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException("No active payment methods configured.");
        }

        // 3. Wrap entire mutating operation in a DB transaction so that
        //    stock decrement, sale creation, transaction record, and cart clear
        //    are committed atomically. Any exception rolls back all changes.
        await using var txn = await db.Database.BeginTransactionAsync(ct);

        try
        {
            // 4. Load cart items (with product and bundle navigations) inside the transaction
            var cartItems = await db.PosCarts
                .Include(c => c.Product)
                .Include(c => c.ProductBundle)
                .Where(c => c.UserId == userId)
                .ToListAsync(ct);

            if (cartItems.Count == 0)
                throw new ArgumentException("Cart is empty. Cannot create a sale.");

            // 5. Per-item calculations:
            //    item.SubTotal = product.Price * quantity           (gross)
            //    item.Discount = (product.Price - product.DiscountedPrice) * quantity
            //    item.Total    = product.DiscountedPrice * quantity (net)
            //
            // Bundle handling:
            //    - Bundle header rows (IsBundleHeader=true, Product=null) produce a
            //      SaleItem header with the bundle price and NO stock deduction.
            //    - Bundle sub-item rows (BundleHeaderPosCartId != null) produce
            //      SaleItem child rows; stock IS deducted for these.
            //    - Normal single-product rows behave as before.

            // Build a lookup of the saved bundle header PosCart.Id → the SaleItem
            // that will represent that bundle in the sale (needed to set
            // BundleHeaderSaleItemId on sub-item SaleItems).
            var saleItems = new List<SaleItem>();
            var bundleHeaderMap = new Dictionary<int, SaleItem>(); // PosCart.Id → SaleItem

            // First pass: create bundle header SaleItems so sub-items can reference them.
            foreach (var cartItem in cartItems.Where(c => c.IsBundleHeader))
            {
                // Bundle header: price comes from the bundle definition (loaded via navigation).
                // PosCartBundle navigation loaded in the Include chain below.
                decimal bundlePrice = cartItem.ProductBundle?.Price ?? 0m;

                var headerSaleItem = new SaleItem
                {
                    ProductId       = null,         // no product for the header
                    Quantity        = cartItem.Quantity,
                    Price           = bundlePrice,
                    PurchasePrice   = 0m,
                    SubTotal        = Math.Round(bundlePrice * cartItem.Quantity, 2),
                    Discount        = 0m,
                    Total           = Math.Round(bundlePrice * cartItem.Quantity, 2),
                    IsBundleHeader  = true,
                    ProductBundleId = cartItem.ProductBundleId,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow,
                };

                saleItems.Add(headerSaleItem);
                bundleHeaderMap[cartItem.Id] = headerSaleItem;
            }

            // Second pass: normal products and bundle sub-items.
            foreach (var cartItem in cartItems.Where(c => !c.IsBundleHeader))
            {
                var product = cartItem.Product;

                // Guard: product still active and in stock
                if (product is null || !product.Status || product.Quantity < cartItem.Quantity)
                    throw new InvalidOperationException(
                        $"Product '{product?.Name ?? "unknown"}' is no longer available in the requested quantity.");

                var itemSubTotal = Math.Round(product.Price * cartItem.Quantity, 2);
                var itemDiscount = Math.Round((product.Price - product.DiscountedPrice) * cartItem.Quantity, 2);
                var itemTotal    = Math.Round(product.DiscountedPrice * cartItem.Quantity, 2);

                // Determine parent header SaleItem for bundle sub-items
                SaleItem? parentHeaderSaleItem = null;
                if (cartItem.BundleHeaderPosCartId.HasValue)
                    bundleHeaderMap.TryGetValue(cartItem.BundleHeaderPosCartId.Value, out parentHeaderSaleItem);

                saleItems.Add(new SaleItem
                {
                    ProductId               = product.Id,
                    Product                 = product,               // needed for DeductStockForItemsAsync
                    Quantity                = cartItem.Quantity,
                    Price                   = product.DiscountedPrice,
                    PurchasePrice           = product.PurchasePrice,
                    SubTotal                = itemSubTotal,
                    Discount                = itemDiscount,
                    Total                   = itemTotal,
                    IsBundleHeader          = false,
                    BundleHeaderSaleItem    = parentHeaderSaleItem,  // EF will resolve the FK
                    BundleStepId            = cartItem.BundleStepId, // multi-step bundle step reference
                    CreatedAt               = DateTime.UtcNow,
                    UpdatedAt               = DateTime.UtcNow,
                });
            }

            // 6. Sale-level totals
            //    For bundles: only count header item totals (not sub-item totals) in the
            //    sale subtotal, because the bundle price already covers all sub-items.
            //    For normal items: count all (non-bundle-sub-item) rows.
            var subTotal = saleItems
                .Where(i => i.BundleHeaderSaleItem == null || i.IsBundleHeader)
                .Sum(i => i.Total);

            // ── Voucher discount (applied before bill-level discount) ─────────────
            decimal voucherAdjustedSubTotal = subTotal;
            string? normalizedVoucherCode = null;

            if (!string.IsNullOrWhiteSpace(request.VoucherCode))
            {
                var voucherResult = await voucherService.ValidateAsync(request.VoucherCode.Trim(), ct);
                if (!voucherResult.IsValid)
                    throw new ArgumentException(voucherResult.Message ?? "Invalid voucher code.");

                normalizedVoucherCode = voucherResult.Code;

                switch (voucherResult.DiscountType?.ToLower())
                {
                    case DiscountTypes.Fixed:
                        voucherAdjustedSubTotal = Math.Max(0m, Math.Round(subTotal - (voucherResult.DiscountValue ?? 0m), 2));
                        break;

                    case DiscountTypes.Percentage:
                        voucherAdjustedSubTotal = Math.Round(subTotal * (1m - (voucherResult.DiscountValue ?? 0m) / 100m), 2);
                        break;

                    case DiscountTypes.Override:
                        if (string.Equals(voucherResult.AppliesTo, "specific_items", StringComparison.OrdinalIgnoreCase)
                            && voucherResult.Items.Count > 0)
                        {
                            var overrideMap = voucherResult.Items
                                .Where(i => i.OverridePrice.HasValue)
                                .ToDictionary(i => i.ProductId, i => i.OverridePrice!.Value);

                            decimal overrideSubTotal = 0m;
                            foreach (var si in saleItems.Where(i => i.BundleHeaderSaleItem == null || i.IsBundleHeader))
                            {
                                if (si.ProductId.HasValue && overrideMap.TryGetValue(si.ProductId.Value, out var overridePrice))
                                {
                                    si.Price   = overridePrice;
                                    si.Total   = Math.Round(overridePrice * si.Quantity, 2);
                                    si.Discount = Math.Max(0m, si.SubTotal - si.Total);
                                }
                                overrideSubTotal += si.Total;
                            }
                            voucherAdjustedSubTotal = Math.Round(overrideSubTotal, 2);
                        }
                        break;
                }
            }

            // R6 Discount Enhancement: if DiscountType is "percentage", convert to monetary.
            // Bill-level discount operates on the voucher-adjusted sub-total.
            decimal monetaryDiscount = request.Discount;
            if (string.Equals(request.DiscountType, DiscountTypes.Percentage, StringComparison.OrdinalIgnoreCase))
                monetaryDiscount = Math.Round(voucherAdjustedSubTotal * request.Discount / 100m, 2);

            if (monetaryDiscount > voucherAdjustedSubTotal)
                throw new ArgumentException("Sale discount cannot exceed the cart sub-total.");

            var total = Math.Round(voucherAdjustedSubTotal - monetaryDiscount, 2);

            // Apply cash rounding if enabled and payment method is cash (AutoFillAmount = false)
            bool isCashPayment = !(resolvedPaymentMethod?.AutoFillAmount ?? false);
            var (roundingSettings_Enabled, roundingSettings_Quantum) = await GetRoundingSettingsAsync(ct);
            decimal roundingAdjustment = 0m;
            decimal roundedTotal = total;
            if (roundingSettings_Enabled && isCashPayment)
            {
                (roundedTotal, roundingAdjustment) = ApplyCashRounding(total, roundingSettings_Quantum);
            }

            // Cap the net paid at roundedTotal; any surplus is change returned to the customer.
            var netPaid = Math.Min(request.Paid, roundedTotal);
            var change  = Math.Max(0m, request.Paid - roundedTotal);
            var due     = Math.Round(roundedTotal - netPaid, 2);
            var status  = due <= 0 ? 1 : 0;

            // 7. Create sale entity
            var sale = new Sale
            {
                UserId             = userId > 0 ? userId : null,
                CustomerId         = request.CustomerId,
                SubTotal           = subTotal,
                Discount           = monetaryDiscount,
                DiscountType       = string.IsNullOrWhiteSpace(request.DiscountType) ? null : request.DiscountType.Trim().ToLower(),
                Total              = total,
                RoundingAdjustment = roundingAdjustment,
                RoundedTotal       = roundedTotal,
                Paid               = netPaid,
                Due                = due,
                Change             = change,
                Note               = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                IsReturned         = false,
                Status             = status,
                CreatedAt          = DateTime.UtcNow,
                UpdatedAt          = DateTime.UtcNow,
                OrderDate          = request.OrderDate ?? DateTime.UtcNow,
                SaleItems          = saleItems,
                VoucherCode        = normalizedVoucherCode,
            };

            db.Sales.Add(sale);

            // 8. Decrement stock for each product (standard + combo component stock).
            await DeductStockForItemsAsync(sale.SaleItems, ct);

            // 9. If paid > 0, create initial payment transaction using the resolved method
            if (netPaid > 0)
            {
                db.SaleTransactions.Add(new SaleTransaction
                {
                    Sale            = sale,
                    CustomerId      = request.CustomerId,
                    UserId          = userId > 0 ? userId : null,
                    Amount          = netPaid,
                    Change          = change,
                    PaidBy          = resolvedPaymentMethod!.Name.ToLower(),
                    PaymentMethodId = resolvedPaymentMethod.Id,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow,
                });
            }

            // 10. Clear the cart — reuse the already-loaded cartItems rows
            db.PosCarts.RemoveRange(cartItems);

            // 11. Commit everything atomically
            await db.SaveChangesAsync(ct);
            await txn.CommitAsync(ct);

            // 12. Return full detail DTO (reload with navigations outside transaction)
            return (await GetByIdAsync(sale.Id, ct))!;
        }
        catch
        {
            await txn.RollbackAsync(ct);
            throw;
        }
    }

    // ── DirectCreateAsync ──────────────────────────────────────────────────────
    public async Task<SaleDetailDto> DirectCreateAsync(
        DirectCreateSaleRequest request,
        int userId,
        CancellationToken ct = default)
    {
        // Pre-transaction guards
        if (request.Items.Count == 0)
            throw new ArgumentException("Sale must have at least one item.");

        if (request.Discount < 0)
            throw new ArgumentException("Sale discount cannot be negative.");

        if (request.Paid < 0)
            throw new ArgumentException("Paid amount cannot be negative.");

        var customerExists = await db.Customers
            .AsNoTracking()
            .AnyAsync(c => c.Id == request.CustomerId, ct);

        if (!customerExists)
            throw new KeyNotFoundException("Customer not found.");

        // Resolve payment method before opening the transaction (read-only).
        PaymentMethod? resolvedPaymentMethod = null;
        if (request.PaymentMethodId.HasValue)
        {
            resolvedPaymentMethod = await db.PaymentMethods
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.Id == request.PaymentMethodId.Value && pm.IsActive, ct)
                ?? throw new ArgumentException("Invalid or inactive payment method.");
        }
        else
        {
            resolvedPaymentMethod = await db.PaymentMethods
                .AsNoTracking()
                .Where(pm => pm.IsActive)
                .OrderByDescending(pm => pm.IsDefault)
                .ThenBy(pm => pm.SortOrder)
                .FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException("No active payment methods configured.");
        }

        await using var txn = await db.Database.BeginTransactionAsync(ct);

        try
        {
            // Load all referenced products in one query
            var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
            var products = await db.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            // Build sale items, validate each line, decrement stock
            var saleItems = new List<SaleItem>();
            foreach (var itemReq in request.Items)
            {
                if (itemReq.Quantity <= 0)
                    throw new ArgumentException(
                        $"Quantity must be greater than zero for product {itemReq.ProductId}.");

                if (!products.TryGetValue(itemReq.ProductId, out var product))
                    throw new KeyNotFoundException($"Product {itemReq.ProductId} not found.");

                if (!product.Status)
                    throw new InvalidOperationException($"Product '{product.Name}' is not active.");

                if (product.Quantity < itemReq.Quantity)
                    throw new InvalidOperationException(
                        $"Insufficient stock for '{product.Name}'. Available: {product.Quantity}, requested: {itemReq.Quantity}.");

                var itemSubTotal = Math.Round(product.Price * itemReq.Quantity, 2);
                var itemDiscount = Math.Round((product.Price - product.DiscountedPrice) * itemReq.Quantity, 2);
                var itemTotal    = Math.Round(product.DiscountedPrice * itemReq.Quantity, 2);

                saleItems.Add(new SaleItem
                {
                    ProductId     = product.Id,
                    Product       = product,               // needed for DeductStockForItemsAsync
                    Quantity      = itemReq.Quantity,
                    Price         = product.DiscountedPrice,
                    PurchasePrice = product.PurchasePrice,
                    SubTotal      = itemSubTotal,
                    Discount      = itemDiscount,
                    Total         = itemTotal,
                    CreatedAt     = DateTime.UtcNow,
                    UpdatedAt     = DateTime.UtcNow,
                });
            }

            // Decrement stock for each product (standard + combo component stock).
            await DeductStockForItemsAsync(saleItems, ct);

            // Sale-level totals
            var subTotal = saleItems.Sum(i => i.Total);

            // Apply voucher discount (mirrors cart-based CreateAsync logic)
            string? normalizedVoucherCode = null;
            decimal voucherAdjustedSubTotal = subTotal;

            if (!string.IsNullOrWhiteSpace(request.VoucherCode))
            {
                var voucherResult = await voucherService.ValidateAsync(request.VoucherCode.Trim(), ct);
                if (!voucherResult.IsValid)
                    throw new ArgumentException(voucherResult.Message ?? "Invalid voucher code.");

                normalizedVoucherCode = voucherResult.Code;

                switch (voucherResult.DiscountType?.ToLower())
                {
                    case DiscountTypes.Fixed:
                        voucherAdjustedSubTotal = Math.Max(0m, Math.Round(subTotal - (voucherResult.DiscountValue ?? 0m), 2));
                        break;

                    case DiscountTypes.Percentage:
                        voucherAdjustedSubTotal = Math.Round(subTotal * (1m - (voucherResult.DiscountValue ?? 0m) / 100m), 2);
                        break;

                    case DiscountTypes.Override:
                        if (string.Equals(voucherResult.AppliesTo, "specific_items", StringComparison.OrdinalIgnoreCase)
                            && voucherResult.Items.Count > 0)
                        {
                            var overrideMap = voucherResult.Items
                                .Where(i => i.OverridePrice.HasValue)
                                .ToDictionary(i => i.ProductId, i => i.OverridePrice!.Value);

                            decimal overrideSubTotal = 0m;
                            foreach (var si in saleItems)
                            {
                                if (si.ProductId.HasValue && overrideMap.TryGetValue(si.ProductId.Value, out var overridePrice))
                                {
                                    si.Price    = overridePrice;
                                    si.Total    = Math.Round(overridePrice * si.Quantity, 2);
                                    si.Discount = Math.Max(0m, si.SubTotal - si.Total);
                                }
                                overrideSubTotal += si.Total;
                            }
                            voucherAdjustedSubTotal = Math.Round(overrideSubTotal, 2);
                        }
                        break;
                }
            }

            // R6 Discount Enhancement: if DiscountType is "percentage", convert to monetary
            decimal monetaryDiscount = request.Discount;
            if (string.Equals(request.DiscountType, DiscountTypes.Percentage, StringComparison.OrdinalIgnoreCase))
                monetaryDiscount = Math.Round(voucherAdjustedSubTotal * request.Discount / 100m, 2);

            if (monetaryDiscount > voucherAdjustedSubTotal)
                throw new ArgumentException("Sale discount cannot exceed the sale sub-total.");

            var total = Math.Round(voucherAdjustedSubTotal - monetaryDiscount, 2);

            // Apply cash rounding if enabled and payment method is cash (AutoFillAmount = false)
            bool isCashPayment = !(resolvedPaymentMethod?.AutoFillAmount ?? false);
            var (roundingEnabled, roundingQuantum) = await GetRoundingSettingsAsync(ct);
            decimal roundingAdjustment = 0m;
            decimal roundedTotal = total;
            if (roundingEnabled && isCashPayment)
            {
                (roundedTotal, roundingAdjustment) = ApplyCashRounding(total, roundingQuantum);
            }

            // Cap the net paid at roundedTotal; any surplus is change returned to the customer.
            var netPaid = Math.Min(request.Paid, roundedTotal);
            var change  = Math.Max(0m, request.Paid - roundedTotal);
            var due     = Math.Round(roundedTotal - netPaid, 2);
            var status  = due <= 0 ? 1 : 0;

            // Create sale entity
            var sale = new Sale
            {
                UserId             = userId > 0 ? userId : null,
                CustomerId         = request.CustomerId,
                SubTotal           = subTotal,
                Discount           = Math.Round(subTotal - total, 2),  // total reduction (voucher + bill discount)
                DiscountType       = string.IsNullOrWhiteSpace(request.DiscountType) ? null : request.DiscountType.Trim().ToLower(),
                Total              = total,
                RoundingAdjustment = roundingAdjustment,
                RoundedTotal       = roundedTotal,
                Paid               = netPaid,
                Due                = due,
                Change             = change,
                Note               = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                IsReturned         = false,
                Status             = status,
                CreatedAt          = DateTime.UtcNow,
                UpdatedAt          = DateTime.UtcNow,
                OrderDate          = request.OrderDate ?? DateTime.UtcNow,
                SaleItems          = saleItems,
                VoucherCode        = normalizedVoucherCode,
            };

            db.Sales.Add(sale);

            // If paid > 0, record an initial payment transaction using the resolved method
            if (netPaid > 0)
            {
                db.SaleTransactions.Add(new SaleTransaction
                {
                    Sale            = sale,
                    CustomerId      = request.CustomerId,
                    UserId          = userId > 0 ? userId : null,
                    Amount          = netPaid,
                    Change          = change,
                    PaidBy          = resolvedPaymentMethod!.Name.ToLower(),
                    PaymentMethodId = resolvedPaymentMethod.Id,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow,
                });
            }

            await db.SaveChangesAsync(ct);
            await txn.CommitAsync(ct);

            return (await GetByIdAsync(sale.Id, ct))!;
        }
        catch
        {
            await txn.RollbackAsync(ct);
            throw;
        }
    }

    // ── ReturnSaleAsync ────────────────────────────────────────────────────────
    public async Task ReturnSaleAsync(int saleId, ReturnSaleRequest request, CancellationToken ct = default)
    {
        await using var txn = await db.Database.BeginTransactionAsync(ct);

        try
        {
            // Load sale with items and product navigations (tracking, not AsNoTracking)
            var sale = await db.Sales
                .Include(s => s.SaleItems)
                    .ThenInclude(i => i.Product)
                .Include(s => s.SaleItems)
                    .ThenInclude(i => i.ProductBundle)
                .FirstOrDefaultAsync(s => s.Id == saleId, ct)
                ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

            if (sale.IsReturned)
                throw new InvalidOperationException("Sale has already been returned.");

            // Mark sale as returned and void the status
            sale.IsReturned = true;
            sale.Status = 0; // due / void
            sale.UpdatedAt = DateTime.UtcNow;

            // Restore stock for each line item (skips bundle headers).
            await RestoreStockForItemsAsync(sale.SaleItems, ct);

            // Record a negative transaction to document the refund amount in the audit trail.
            // Amount is negative to distinguish it from regular payment transactions.
            if (sale.Paid > 0)
            {
                db.SaleTransactions.Add(new SaleTransaction
                {
                    SaleId     = sale.Id,
                    CustomerId = sale.CustomerId,
                    UserId     = null,
                    Amount     = -sale.Paid,
                    Change     = 0m,
                    PaidBy     = "return",
                    CreatedAt  = DateTime.UtcNow,
                    UpdatedAt  = DateTime.UtcNow,
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
    }

    // ── CreateOpenOrderAsync ───────────────────────────────────────────────────
    public async Task<SaleDetailDto> CreateOpenOrderAsync(
        CreateOpenOrderRequest req,
        int userId,
        CancellationToken ct = default)
    {
        bool isTakeaway = string.Equals(req.OrderType, OrderTypes.Takeaway, StringComparison.OrdinalIgnoreCase);

        if (!isTakeaway)
        {
            // Dine-in: TableId is required and must be a valid active table with no existing open order
            if (!req.TableId.HasValue || req.TableId.Value < 1)
                throw new ArgumentException("A valid table is required for dine-in orders.");

            var tableExists = await db.RestaurantTables
                .AsNoTracking()
                .AnyAsync(t => t.Id == req.TableId.Value && t.IsActive, ct);

            if (!tableExists)
                throw new KeyNotFoundException($"Table {req.TableId} not found or is not active.");

            var existingOpen = await db.Sales
                .AsNoTracking()
                .AnyAsync(s => s.TableId == req.TableId && s.OrderStatus == OrderStatuses.Open, ct);

            if (existingOpen)
                throw new InvalidOperationException($"Table {req.TableId} already has an open order. Close or settle it before opening a new one.");
        }

        int customerId = req.CustomerId ?? 1; // default to walking customer

        var customerExists = await db.Customers
            .AsNoTracking()
            .AnyAsync(c => c.Id == customerId, ct);

        if (!customerExists)
            throw new KeyNotFoundException($"Customer {customerId} not found.");

        var sale = new Sale
        {
            UserId      = userId > 0 ? userId : null,
            CustomerId  = customerId,
            TableId     = req.TableId,
            OrderType   = string.IsNullOrWhiteSpace(req.OrderType) ? OrderTypes.DineIn : req.OrderType.Trim().ToLower(),
            OrderStatus = OrderStatuses.Open,
            SubTotal    = 0m,
            Discount    = 0m,
            Total       = 0m,
            RoundedTotal = 0m,
            Paid        = 0m,
            Due         = 0m,
            Change      = 0m,
            Status      = 0,
            IsReturned  = false,
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
            OrderDate   = DateTime.UtcNow,
        };

        db.Sales.Add(sale);

        // Mark table as occupied (dine-in only — takeaway has no table)
        if (!isTakeaway && req.TableId.HasValue)
            await tableService.SetStatusAsync(req.TableId.Value, TableStatuses.Occupied);

        await db.SaveChangesAsync(ct);

        return (await GetByIdAsync(sale.Id, ct))!;
    }

    // ── GetOpenOrdersAsync ─────────────────────────────────────────────────────
    public async Task<IEnumerable<SaleDetailDto>> GetOpenOrdersAsync(CancellationToken ct = default)
    {
        var sales = await db.Sales
            .AsNoTracking()
            .Include(s => s.Customer)
            .Include(s => s.User)
            .Include(s => s.Table)
            .Include(s => s.SaleItems)
                .ThenInclude(i => i.Product)
            .Include(s => s.SaleItems)
                .ThenInclude(i => i.ProductBundle)
            .Include(s => s.SaleTransactions)
                .ThenInclude(t => t.User)
            .Include(s => s.SaleTransactions)
                .ThenInclude(t => t.PaymentMethod)
            .Where(s => s.OrderStatus == OrderStatuses.Open)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync(ct);

        return mapper.Map<List<SaleDetailDto>>(sales);
    }

    // ── GetOpenOrderForTableAsync ──────────────────────────────────────────────
    public async Task<SaleDetailDto?> GetOpenOrderForTableAsync(int tableId, CancellationToken ct = default)
    {
        // Tracking required so we can mutate and save if the order is a ghost (all items voided).
        var sale = await db.Sales
            .Include(s => s.Customer)
            .Include(s => s.User)
            .Include(s => s.Table)
            .Include(s => s.SaleItems)
                .ThenInclude(i => i.Product)
            .Include(s => s.SaleItems)
                .ThenInclude(i => i.ProductBundle)
            .Include(s => s.SaleTransactions)
                .ThenInclude(t => t.User)
            .Include(s => s.SaleTransactions)
                .ThenInclude(t => t.PaymentMethod)
            .FirstOrDefaultAsync(s => s.TableId == tableId && s.OrderStatus == OrderStatuses.Open, ct);

        if (sale is null)
            return null;

        // Auto-release: if all items have been voided the order is a ghost — free the table.
        var activeItemCount = sale.SaleItems.Count(i => !i.IsVoided && !i.IsBundleHeader);
        if (activeItemCount == 0)
        {
            sale.OrderStatus = OrderStatuses.Voided;
            if (sale.TableId.HasValue)
                await tableService.SetStatusAsync(sale.TableId.Value, TableStatuses.Available, ct);
            await db.SaveChangesAsync(ct);
            throw new KeyNotFoundException($"No active open order for table {tableId}.");
        }

        return mapper.Map<SaleDetailDto>(sale);
    }

    // ── AddItemToSaleAsync ─────────────────────────────────────────────────────
    public async Task<SaleDetailDto> AddItemToSaleAsync(
        int saleId,
        AddSaleItemRequest req,
        int userId,
        CancellationToken ct = default)
    {
        var sale = await db.Sales
            .Include(s => s.SaleItems)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct)
            ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

        if (sale.OrderStatus != OrderStatuses.Open)
            throw new InvalidOperationException("Items can only be added to open orders.");

        // Validate product is POS-eligible
        var product = await db.Products
            .FirstOrDefaultAsync(p => p.Id == req.ProductId, ct)
            ?? throw new KeyNotFoundException($"Product {req.ProductId} not found.");

        if (!product.Status)
            throw new InvalidOperationException($"Product '{product.Name}' is not active.");

        if (product.Quantity < req.Quantity)
            throw new InvalidOperationException(
                $"Insufficient stock for '{product.Name}'. Available: {product.Quantity}, requested: {req.Quantity}.");

        // Effective selling price: override takes precedence over product price
        decimal effectivePrice = req.OverriddenPrice ?? product.DiscountedPrice;

        var saleItem = new SaleItem
        {
            SaleId           = saleId,
            ProductId        = product.Id,
            Quantity         = req.Quantity,
            Price            = effectivePrice,
            PurchasePrice    = product.PurchasePrice,
            OverriddenPrice  = req.OverriddenPrice,
            ModifierNote     = string.IsNullOrWhiteSpace(req.ModifierNote) ? null : req.ModifierNote.Trim(),
            ItemDiscount     = req.ItemDiscount,
            ItemDiscountType = string.IsNullOrWhiteSpace(req.ItemDiscountType) ? null : req.ItemDiscountType.Trim().ToLower(),
            KitchenSentAt    = null,  // not sent to kitchen yet
            IsVoided         = false,
            SubTotal         = Math.Round(product.Price * req.Quantity, 2),
            Discount         = Math.Round((product.Price - effectivePrice) * req.Quantity, 2),
            Total            = Math.Round(effectivePrice * req.Quantity, 2),
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
        };

        db.SaleItems.Add(saleItem);

        // Recalculate sale totals from all non-voided, non-sub-item rows
        // NOTE: stock is NOT deducted at add time — deducted at settlement
        RecalculateOpenOrderTotals(sale);

        sale.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return (await GetByIdAsync(saleId, ct))!;
    }

    // ── AddItemsBatchToSaleAsync ───────────────────────────────────────────────
    public async Task<SaleDetailDto> AddItemsBatchToSaleAsync(
        int saleId,
        List<AddSaleItemRequest> items,
        int userId,
        CancellationToken ct = default)
    {
        if (items is null || items.Count == 0)
            throw new ArgumentException("At least one item is required.");

        var sale = await db.Sales
            .Include(s => s.SaleItems)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct)
            ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

        if (sale.OrderStatus != OrderStatuses.Open)
            throw new InvalidOperationException("Items can only be added to open orders.");

        var now = DateTime.UtcNow;

        // ── Separate bundle entries from regular product entries ──────────────
        var bundleEntries  = items.Where(i => i.BundleId.HasValue).ToList();
        var productEntries = items.Where(i => !i.BundleId.HasValue).ToList();

        // ── Pass 1: bundle entries ────────────────────────────────────────────
        // The ProductBundle model only stores name/price/IsActive — there is no
        // BundleItems collection on the entity.  Sub-item products are entirely
        // caller-supplied via SelectedProducts (same contract as the cart service).
        //
        // Algorithm (mirrors CreateSaleFromCartAsync two-pass pattern):
        //   1. Load each referenced bundle definition (name, price, IsActive).
        //   2. Create one IsBundleHeader SaleItem at the bundle price.
        //   3. For each entry in SelectedProducts, load the product and create a
        //      child SaleItem with Price=0 / Total=0, pointing at the header.
        //
        // Stock is NOT deducted here — it is deducted at settlement (SettleOrderAsync).

        if (bundleEntries.Count > 0)
        {
            // Load all required bundle definitions in one query
            var bundleIds = bundleEntries.Select(e => e.BundleId!.Value).Distinct().ToList();

            var bundleDefinitions = await db.ProductBundles
                .Where(b => bundleIds.Contains(b.Id))
                .ToDictionaryAsync(b => b.Id, ct);

            // Collect every sub-product ID across all bundle entries so we can
            // load them in a single query rather than one-per-entry.
            var allSubProductIds = bundleEntries
                .Where(e => e.SelectedProducts is { Count: > 0 })
                .SelectMany(e => e.SelectedProducts!.Select(sp => sp.ProductId))
                .Distinct()
                .ToList();

            var subProducts = allSubProductIds.Count > 0
                ? await db.Products
                    .Where(p => allSubProductIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, ct)
                : new Dictionary<int, Product>();

            foreach (var req in bundleEntries)
            {
                int bundleId = req.BundleId!.Value;

                if (!bundleDefinitions.TryGetValue(bundleId, out var bundle))
                    throw new KeyNotFoundException($"Product bundle {bundleId} not found.");

                if (!bundle.IsActive)
                    throw new InvalidOperationException($"Product bundle '{bundle.Name}' is not active.");

                if (req.SelectedProducts is null || req.SelectedProducts.Count == 0)
                    throw new ArgumentException(
                        $"SelectedProducts must be provided for bundle {bundle.Name} (id={bundleId}).");

                int headerQty = req.Quantity > 0 ? req.Quantity : 1;

                // Create the bundle header SaleItem
                var headerSaleItem = new SaleItem
                {
                    SaleId          = saleId,
                    ProductId       = null,         // bundle headers have no single product
                    Quantity        = headerQty,
                    Price           = bundle.Price,
                    PurchasePrice   = 0m,
                    OverriddenPrice = null,
                    ModifierNote    = string.IsNullOrWhiteSpace(req.ModifierNote) ? null : req.ModifierNote.Trim(),
                    ItemDiscount    = 0m,
                    SubTotal        = Math.Round(bundle.Price * headerQty, 2),
                    Discount        = 0m,
                    Total           = Math.Round(bundle.Price * headerQty, 2),
                    IsBundleHeader  = true,
                    ProductBundleId = bundleId,
                    KitchenSentAt   = null,
                    IsVoided        = false,
                    CreatedAt       = now,
                    UpdatedAt       = now,
                };

                db.SaleItems.Add(headerSaleItem);

                // Create one child SaleItem per selected product
                foreach (var selection in req.SelectedProducts)
                {
                    if (!subProducts.TryGetValue(selection.ProductId, out var subProduct))
                        throw new KeyNotFoundException(
                            $"Product {selection.ProductId} not found (bundle sub-item for bundle {bundleId}).");

                    int subQty = selection.Quantity > 0 ? selection.Quantity : 1;

                    var subSaleItem = new SaleItem
                    {
                        SaleId               = saleId,
                        ProductId            = subProduct.Id,
                        Quantity             = subQty,
                        Price                = 0m,   // price is covered by the bundle header
                        PurchasePrice        = subProduct.PurchasePrice,
                        OverriddenPrice      = null,
                        ModifierNote         = null,
                        ItemDiscount         = 0m,
                        SubTotal             = 0m,
                        Discount             = 0m,
                        Total                = 0m,
                        IsBundleHeader       = false,
                        BundleHeaderSaleItem = headerSaleItem,  // EF resolves the FK after save
                        BundleStepId         = selection.BundleStepId, // multi-step bundle step reference
                        KitchenSentAt        = null,
                        IsVoided             = false,
                        CreatedAt            = now,
                        UpdatedAt            = now,
                    };

                    db.SaleItems.Add(subSaleItem);
                }
            }
        }

        // ── Pass 2: regular product entries ──────────────────────────────────
        if (productEntries.Count > 0)
        {
            // Collect all unique product IDs so we can load them in one query.
            var productIds = productEntries
                .Where(i => i.ProductId.HasValue)
                .Select(i => i.ProductId!.Value)
                .Distinct()
                .ToList();

            var products = await db.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, ct);

            foreach (var req in productEntries)
            {
                if (!req.ProductId.HasValue)
                    throw new ArgumentException("ProductId is required for non-bundle items.");

                if (!products.TryGetValue(req.ProductId.Value, out var product))
                    throw new KeyNotFoundException($"Product {req.ProductId.Value} not found.");

                if (!product.Status)
                    throw new InvalidOperationException($"Product '{product.Name}' is not active.");

                if (product.Quantity < req.Quantity)
                    throw new InvalidOperationException(
                        $"Insufficient stock for '{product.Name}'. Available: {product.Quantity}, requested: {req.Quantity}.");

                decimal effectivePrice = req.OverriddenPrice ?? product.DiscountedPrice;

                var saleItem = new SaleItem
                {
                    SaleId           = saleId,
                    ProductId        = product.Id,
                    Quantity         = req.Quantity,
                    Price            = effectivePrice,
                    PurchasePrice    = product.PurchasePrice,
                    OverriddenPrice  = req.OverriddenPrice,
                    ModifierNote     = string.IsNullOrWhiteSpace(req.ModifierNote) ? null : req.ModifierNote.Trim(),
                    ItemDiscount     = req.ItemDiscount,
                    ItemDiscountType = string.IsNullOrWhiteSpace(req.ItemDiscountType) ? null : req.ItemDiscountType.Trim().ToLower(),
                    KitchenSentAt    = null,
                    IsVoided         = false,
                    SubTotal         = Math.Round(product.Price * req.Quantity, 2),
                    Discount         = Math.Round((product.Price - effectivePrice) * req.Quantity, 2),
                    Total            = Math.Round(effectivePrice * req.Quantity, 2),
                    CreatedAt        = now,
                    UpdatedAt        = now,
                };

                db.SaleItems.Add(saleItem);
            }
        }

        // Recalculate sale totals once after all items are staged (not per item).
        // NOTE: stock is NOT deducted here — deducted at settlement.
        RecalculateOpenOrderTotals(sale);
        sale.UpdatedAt = now;

        await db.SaveChangesAsync(ct);

        return (await GetByIdAsync(saleId, ct))!;
    }

    // ── UpdateSaleItemAsync ────────────────────────────────────────────────────
    public async Task<SaleDetailDto> UpdateSaleItemAsync(
        int saleId,
        int itemId,
        PatchSaleItemRequest req,
        int userId,
        CancellationToken ct = default)
    {
        var sale = await db.Sales
            .Include(s => s.SaleItems)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct)
            ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

        if (sale.OrderStatus != OrderStatuses.Open)
            throw new InvalidOperationException("Items can only be updated on open orders.");

        var item = sale.SaleItems.FirstOrDefault(i => i.Id == itemId)
            ?? throw new KeyNotFoundException($"Sale item {itemId} not found on sale {saleId}.");

        if (item.IsVoided)
            throw new InvalidOperationException("Cannot update a voided sale item.");

        var now = DateTime.UtcNow;

        if (item.KitchenSentAt.HasValue)
        {
            // Item already sent to kitchen — void the old row and create a new replacement
            item.IsVoided        = true;
            item.VoidedAt        = now;
            item.VoidedByUserId  = userId;

            // Load product for the new item
            var product = await db.Products
                .FirstOrDefaultAsync(p => p.Id == item.ProductId, ct)
                ?? throw new KeyNotFoundException($"Product {item.ProductId} not found.");

            int newQty = req.Quantity ?? item.Quantity;
            decimal newPrice = req.OverriddenPrice ?? item.OverriddenPrice ?? item.Price;

            var replacement = new SaleItem
            {
                SaleId           = saleId,
                ProductId        = item.ProductId,
                Quantity         = newQty,
                Price            = newPrice,
                PurchasePrice    = item.PurchasePrice,
                OverriddenPrice  = req.OverriddenPrice ?? item.OverriddenPrice,
                ModifierNote     = req.ModifierNote != null
                    ? (string.IsNullOrWhiteSpace(req.ModifierNote) ? null : req.ModifierNote.Trim())
                    : item.ModifierNote,
                ItemDiscount     = req.ItemDiscount ?? item.ItemDiscount,
                ItemDiscountType = req.ItemDiscountType != null
                    ? (string.IsNullOrWhiteSpace(req.ItemDiscountType) ? null : req.ItemDiscountType.Trim().ToLower())
                    : item.ItemDiscountType,
                KitchenSentAt    = null,  // new row — not yet sent to kitchen
                IsVoided         = false,
                SubTotal         = Math.Round(product.Price * newQty, 2),
                Discount         = Math.Round((product.Price - newPrice) * newQty, 2),
                Total            = Math.Round(newPrice * newQty, 2),
                CreatedAt        = now,
                UpdatedAt        = now,
            };

            db.SaleItems.Add(replacement);
        }
        else
        {
            // Not yet sent to kitchen — update in place
            if (req.Quantity.HasValue)
                item.Quantity = req.Quantity.Value;

            if (req.OverriddenPrice.HasValue)
                item.OverriddenPrice = req.OverriddenPrice;

            if (req.ModifierNote != null)
                item.ModifierNote = string.IsNullOrWhiteSpace(req.ModifierNote) ? null : req.ModifierNote.Trim();

            if (req.ItemDiscount.HasValue)
                item.ItemDiscount = req.ItemDiscount.Value;

            if (req.ItemDiscountType != null)
                item.ItemDiscountType = string.IsNullOrWhiteSpace(req.ItemDiscountType) ? null : req.ItemDiscountType.Trim().ToLower();

            decimal effectivePrice = item.OverriddenPrice ?? item.Price;
            var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
            decimal grossPrice = product?.Price ?? item.Price;

            item.Price    = effectivePrice;
            item.SubTotal = Math.Round(grossPrice * item.Quantity, 2);
            item.Discount = Math.Round((grossPrice - effectivePrice) * item.Quantity, 2);
            item.Total    = Math.Round(effectivePrice * item.Quantity, 2);
            item.UpdatedAt = now;
        }

        RecalculateOpenOrderTotals(sale);
        sale.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        return (await GetByIdAsync(saleId, ct))!;
    }

    // ── VoidSaleItemAsync ──────────────────────────────────────────────────────
    public async Task<(SaleDetailDto Sale, KitchenTicketResponse? VoidTicket)> VoidSaleItemAsync(
        int saleId,
        int itemId,
        int userId,
        CancellationToken ct = default)
    {
        var sale = await db.Sales
            .Include(s => s.SaleItems)
                .ThenInclude(i => i.Product)
            .Include(s => s.SaleItems)
                .ThenInclude(i => i.ProductBundle)
            .Include(s => s.Table)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct)
            ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

        if (sale.OrderStatus != OrderStatuses.Open)
            throw new InvalidOperationException("Items can only be voided on open orders.");

        var item = sale.SaleItems.FirstOrDefault(i => i.Id == itemId)
            ?? throw new KeyNotFoundException($"Sale item {itemId} not found on sale {saleId}.");

        if (item.IsVoided)
            throw new InvalidOperationException("Sale item is already voided.");

        var now = DateTime.UtcNow;
        bool wasKitchenSent = item.KitchenSentAt.HasValue;

        item.IsVoided       = true;
        item.VoidedAt       = now;
        item.VoidedByUserId = userId;

        RecalculateOpenOrderTotals(sale);
        sale.UpdatedAt = now;

        // If every item on this open order is now voided, auto-release the table
        // and close the sale so it doesn't persist as an empty ghost order.
        bool allVoided = sale.SaleItems.All(i => i.IsVoided);
        if (allVoided)
        {
            sale.OrderStatus = OrderStatuses.Voided;
            if (sale.TableId.HasValue)
                await tableService.SetStatusAsync(sale.TableId.Value, TableStatuses.Available);
        }

        await db.SaveChangesAsync(ct);

        KitchenTicketResponse? voidTicket = null;
        if (wasKitchenSent)
        {
            // Build a void notification ticket for the kitchen printer
            voidTicket = new KitchenTicketResponse
            {
                SaleId      = saleId,
                TableNumber = sale.Table?.Number.ToString(),
                TableLabel  = sale.Table?.Label,
                SentAt      = now,
                TicketItems = new List<KitchenTicketItem>
                {
                    new KitchenTicketItem
                    {
                        ProductName  = item.Product?.Name ?? string.Empty,
                        Quantity     = item.Quantity,
                        ModifierNote = item.ModifierNote,
                        IsVoid       = true,
                    }
                }
            };
        }

        return ((await GetByIdAsync(saleId, ct))!, voidTicket);
    }

    // ── SendToKitchenAsync ─────────────────────────────────────────────────────
    public async Task<KitchenTicketResponse> SendToKitchenAsync(int saleId, CancellationToken ct = default)
    {
        var sale = await db.Sales
            .Include(s => s.SaleItems)
                .ThenInclude(i => i.Product)
            .Include(s => s.Table)
            .FirstOrDefaultAsync(s => s.Id == saleId, ct)
            ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

        bool statusOk = sale.OrderStatus == OrderStatuses.Open ||
            (string.Equals(sale.OrderType, OrderTypes.Takeaway, StringComparison.OrdinalIgnoreCase)
             && sale.OrderStatus == OrderStatuses.Paid);

        if (!statusOk)
            throw new InvalidOperationException("Can only send to kitchen for open orders (or paid takeaway orders).");

        // Find all unsent, non-voided items
        var unsentItems = sale.SaleItems
            .Where(i => i.KitchenSentAt == null && !i.IsVoided && !i.IsBundleHeader)
            .ToList();

        if (unsentItems.Count == 0)
            throw new InvalidOperationException("No new items to send to kitchen. All items have already been sent.");

        var now = DateTime.UtcNow;

        // Stamp each item
        foreach (var item in unsentItems)
        {
            item.KitchenSentAt = now;
            item.UpdatedAt     = now;
        }

        sale.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        return new KitchenTicketResponse
        {
            SaleId      = saleId,
            TableNumber = sale.Table?.Number.ToString(),
            TableLabel  = sale.Table?.Label,
            OrderType   = sale.OrderType,
            SentAt      = now,
            TicketItems = unsentItems.Select(i => new KitchenTicketItem
            {
                ProductName  = i.Product?.Name ?? string.Empty,
                Quantity     = i.Quantity,
                ModifierNote = i.ModifierNote,
                IsVoid       = false,
            }).ToList(),
        };
    }

    // ── SettleOrderAsync ───────────────────────────────────────────────────────
    public async Task<SaleDetailDto> SettleOrderAsync(
        int saleId,
        SettleOrderRequest req,
        int userId,
        HttpResponse httpResponse,
        CancellationToken ct = default)
    {
        // Resolve payment method before opening the transaction (read-only)
        PaymentMethod? resolvedPaymentMethod;
        if (req.PaymentMethodId.HasValue)
        {
            resolvedPaymentMethod = await db.PaymentMethods
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.Id == req.PaymentMethodId.Value && pm.IsActive, ct)
                ?? throw new ArgumentException("Invalid or inactive payment method.");
        }
        else
        {
            resolvedPaymentMethod = await db.PaymentMethods
                .AsNoTracking()
                .Where(pm => pm.IsActive)
                .OrderByDescending(pm => pm.IsDefault)
                .ThenBy(pm => pm.SortOrder)
                .FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException("No active payment methods configured.");
        }

        await using var txn = await db.Database.BeginTransactionAsync(ct);

        try
        {
            var sale = await db.Sales
                .Include(s => s.SaleItems)
                    .ThenInclude(i => i.Product)
                .Include(s => s.SaleItems)
                    .ThenInclude(i => i.ProductBundle)
                .Include(s => s.Table)
                .FirstOrDefaultAsync(s => s.Id == saleId, ct)
                ?? throw new KeyNotFoundException($"Sale {saleId} not found.");

            if (sale.OrderStatus != OrderStatuses.Open)
                throw new InvalidOperationException("Only open orders can be settled.");

            // Collect all non-voided items (bundle headers excluded from stock but included in price)
            var activeItems = sale.SaleItems.Where(i => !i.IsVoided).ToList();

            if (activeItems.Count == 0)
                throw new InvalidOperationException("Cannot settle an order with no active items.");

            // ── Calculate totals ───────────────────────────────────────────────
            // SubTotal = sum of (effectivePrice * qty - itemLevelDiscount) for non-voided, non-sub-items
            // Bundle sub-items are excluded from sale-level subtotal (bundle header covers them)
            decimal subTotal = 0m;
            foreach (var item in activeItems.Where(i => i.BundleHeaderSaleItemId == null))
            {
                decimal effectivePrice = item.OverriddenPrice ?? item.Price;
                decimal itemLineTotal  = Math.Round(effectivePrice * item.Quantity, 2);

                // Apply item-level discount
                if (item.ItemDiscount > 0)
                {
                    decimal itemLevelDiscount = item.ItemDiscountType == DiscountTypes.Percentage
                        ? Math.Round(itemLineTotal * item.ItemDiscount / 100m, 2)
                        : item.ItemDiscount;
                    itemLineTotal = Math.Max(0m, itemLineTotal - itemLevelDiscount);
                }

                subTotal += itemLineTotal;
            }
            subTotal = Math.Round(subTotal, 2);

            // ── Apply voucher discount (Phase 5) — applied BEFORE bill discount ─
            decimal voucherAdjustedSubTotal = subTotal;
            if (!string.IsNullOrWhiteSpace(req.VoucherCode))
            {
                var voucherResult = await voucherService.ValidateAsync(req.VoucherCode.Trim(), ct);
                if (!voucherResult.IsValid)
                    throw new ArgumentException($"Invalid voucher: {voucherResult.Message}");

                switch (voucherResult.DiscountType?.ToLower())
                {
                    case DiscountTypes.Fixed:
                        voucherAdjustedSubTotal = Math.Max(0m, Math.Round(subTotal - (voucherResult.DiscountValue ?? 0m), 2));
                        break;

                    case DiscountTypes.Percentage:
                        voucherAdjustedSubTotal = Math.Round(subTotal * (1m - (voucherResult.DiscountValue ?? 0m) / 100m), 2);
                        break;

                    case DiscountTypes.Override:
                        if (string.Equals(voucherResult.AppliesTo, "specific_items", StringComparison.OrdinalIgnoreCase)
                            && voucherResult.Items.Count > 0)
                        {
                            var overrideDict = voucherResult.Items
                                .Where(i => i.OverridePrice.HasValue)
                                .ToDictionary(i => i.ProductId, i => i.OverridePrice!.Value);

                            decimal overriddenSubTotal = 0m;
                            foreach (var item in activeItems.Where(i => i.BundleHeaderSaleItemId == null))
                            {
                                decimal effectivePrice = (item.ProductId.HasValue && overrideDict.TryGetValue(item.ProductId.Value, out var op))
                                    ? op
                                    : (item.OverriddenPrice ?? item.Price);

                                decimal itemLineTotal = Math.Round(effectivePrice * item.Quantity, 2);

                                if (item.ItemDiscount > 0)
                                {
                                    decimal itemLevelDiscount = item.ItemDiscountType == DiscountTypes.Percentage
                                        ? Math.Round(itemLineTotal * item.ItemDiscount / 100m, 2)
                                        : item.ItemDiscount;
                                    itemLineTotal = Math.Max(0m, itemLineTotal - itemLevelDiscount);
                                }

                                overriddenSubTotal += itemLineTotal;
                            }
                            voucherAdjustedSubTotal = Math.Round(overriddenSubTotal, 2);
                        }
                        break;
                }
            }

            // Apply bill-level discount (R6) on top of voucher-adjusted sub-total
            decimal billDiscountMonetary;
            if (string.Equals(req.DiscountType, DiscountTypes.Percentage, StringComparison.OrdinalIgnoreCase))
                billDiscountMonetary = Math.Round(voucherAdjustedSubTotal * req.BillDiscount / 100m, 2);
            else
                billDiscountMonetary = req.BillDiscount;

            if (billDiscountMonetary > voucherAdjustedSubTotal)
                throw new ArgumentException("Bill discount cannot exceed the order sub-total.");

            var total = Math.Round(voucherAdjustedSubTotal - billDiscountMonetary, 2);

            // Apply cash rounding
            bool isCashPayment = !(resolvedPaymentMethod.AutoFillAmount);
            var (roundingEnabled, roundingQuantum) = await GetRoundingSettingsAsync(ct);
            decimal roundingAdjustment = 0m;
            decimal roundedTotal = total;
            if (roundingEnabled && isCashPayment)
            {
                (roundedTotal, roundingAdjustment) = ApplyCashRounding(total, roundingQuantum);
            }

            decimal netPaid = Math.Min(req.Paid, roundedTotal);
            decimal change  = Math.Max(0m, req.Paid - roundedTotal);
            decimal due     = Math.Round(roundedTotal - netPaid, 2);
            int status      = due <= 0 ? 1 : 0;

            // ── Override CustomerId if provided ───────────────────────────────
            if (req.CustomerId.HasValue && req.CustomerId.Value > 0)
            {
                var customerExists = await db.Customers
                    .AsNoTracking()
                    .AnyAsync(c => c.Id == req.CustomerId.Value, ct);

                if (!customerExists)
                    throw new KeyNotFoundException($"Customer {req.CustomerId.Value} not found.");

                sale.CustomerId = req.CustomerId.Value;
            }

            // ── Settle the sale ────────────────────────────────────────────────
            sale.SubTotal           = subTotal;   // original pre-all-discounts sum
            sale.Discount           = Math.Round(subTotal - total, 2);  // total reduction (voucher + bill)
            sale.DiscountType       = string.IsNullOrWhiteSpace(req.DiscountType) ? null : req.DiscountType.Trim().ToLower();
            sale.Total              = total;
            sale.RoundingAdjustment = roundingAdjustment;
            sale.RoundedTotal       = roundedTotal;
            sale.Paid               = netPaid;
            sale.Due                = due;
            sale.Change             = change;
            sale.Status             = status;
            sale.OrderStatus        = OrderStatuses.Paid;
            sale.VoucherCode        = string.IsNullOrWhiteSpace(req.VoucherCode) ? null : req.VoucherCode.Trim();
            sale.Note               = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
            sale.UpdatedAt          = DateTime.UtcNow;

            // ── Release table ──────────────────────────────────────────────────
            if (sale.TableId.HasValue)
                await tableService.SetStatusAsync(sale.TableId.Value, TableStatuses.Available);

            // ── Deduct stock for non-voided items (standard + combo component stock) ──
            await DeductStockForItemsAsync(activeItems, ct);

            // ── R7: Apply takeaway charge if applicable ────────────────────────
            if (sale.OrderType == OrderTypes.Takeaway)
            {
                var takeawaySettings = await db.Settings
                    .Where(s => s.Key == "takeaway_charge_enabled" || s.Key == "takeaway_charge_amount")
                    .Select(s => new { s.Key, s.Value })
                    .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

                var takeawayEnabled = takeawaySettings.GetValueOrDefault("takeaway_charge_enabled");
                var chargeStr       = takeawaySettings.GetValueOrDefault("takeaway_charge_amount");

                if (takeawayEnabled == "true")
                {

                    if (decimal.TryParse(chargeStr, out var takeawayCharge) && takeawayCharge > 0)
                    {
                        sale.TakeawayCharge = takeawayCharge;
                        // Re-add charge to total, paid, due, change
                        sale.Total        = Math.Round(sale.Total + takeawayCharge, 2);
                        sale.RoundedTotal = Math.Round(sale.RoundedTotal + takeawayCharge, 2);
                        // Recalculate paid/due/change using the updated rounded total
                        var newNetPaid = Math.Min(req.Paid, sale.RoundedTotal);
                        sale.Paid   = newNetPaid;
                        sale.Change = Math.Max(0m, req.Paid - sale.RoundedTotal);
                        sale.Due    = Math.Round(sale.RoundedTotal - newNetPaid, 2);
                        sale.Status = sale.Due <= 0 ? 1 : 0;
                    }
                }
            }

            // ── Create payment transaction ─────────────────────────────────────
            if (netPaid > 0)
            {
                db.SaleTransactions.Add(new SaleTransaction
                {
                    Sale            = sale,
                    CustomerId      = sale.CustomerId,
                    UserId          = userId > 0 ? userId : null,
                    Amount          = netPaid,
                    Change          = change,
                    PaidBy          = resolvedPaymentMethod.Name.ToLower(),
                    PaymentMethodId = resolvedPaymentMethod.Id,
                    CreatedAt       = DateTime.UtcNow,
                    UpdatedAt       = DateTime.UtcNow,
                });
            }

            await db.SaveChangesAsync(ct);
            await txn.CommitAsync(ct);

            return (await GetByIdAsync(sale.Id, ct))!;
        }
        catch
        {
            await txn.RollbackAsync(ct);
            throw;
        }
    }

    // ── MergeAsync ─────────────────────────────────────────────────────────────
    public async Task<SaleDetailDto> MergeAsync(
        int primarySaleId,
        MergeOrderRequest request,
        int userId,
        CancellationToken ct = default)
    {
        var primarySale = await db.Sales
            .Include(s => s.SaleItems)
            .FirstOrDefaultAsync(s => s.Id == primarySaleId, ct)
            ?? throw new KeyNotFoundException($"Sale {primarySaleId} not found.");

        if (primarySale.OrderStatus != OrderStatuses.Open)
            throw new InvalidOperationException("Primary sale must be an open order.");

        if (request.AbsorbSaleIds.Count == 0)
            throw new ArgumentException("At least one sale to absorb must be provided.");

        // Pre-load all absorbed sales in a single query to avoid N+1
        var absorbedSales = await db.Sales
            .Include(s => s.SaleItems)
            .Where(s => request.AbsorbSaleIds.Contains(s.Id))
            .ToListAsync(ct);

        if (absorbedSales.Count != request.AbsorbSaleIds.Count)
        {
            var missing = request.AbsorbSaleIds.Except(absorbedSales.Select(s => s.Id)).First();
            throw new KeyNotFoundException($"Sale {missing} not found.");
        }

        var absorbedById = absorbedSales.ToDictionary(s => s.Id);

        await using var txn = await db.Database.BeginTransactionAsync(ct);
        try
        {
            var now = DateTime.UtcNow;

            foreach (var absorbId in request.AbsorbSaleIds)
            {
                if (absorbId == primarySaleId)
                    throw new ArgumentException("Cannot merge a sale with itself.");

                var absorbedSale = absorbedById[absorbId];

                if (absorbedSale.OrderStatus != OrderStatuses.Open)
                    throw new InvalidOperationException($"Sale {absorbId} must be an open order to be absorbed.");

                // Move all non-voided items to the primary sale
                foreach (var item in absorbedSale.SaleItems.Where(i => !i.IsVoided))
                    item.SaleId = primarySaleId;

                // Void the absorbed sale
                absorbedSale.OrderStatus = OrderStatuses.Voided;
                absorbedSale.UpdatedAt   = now;

                // Release the absorbed table
                if (absorbedSale.TableId.HasValue)
                    await tableService.SetStatusAsync(absorbedSale.TableId.Value, TableStatuses.Available);

                // Audit record
                db.TableMerges.Add(new TableMerge
                {
                    PrimarySaleId   = primarySaleId,
                    AbsorbedTableId = absorbedSale.TableId,
                    AbsorbedSaleId  = absorbId,
                    MergedByUserId  = userId > 0 ? userId : null,
                    MergedAt        = now,
                });
            }

            // Reload items and recalculate totals
            await db.Entry(primarySale).Collection(s => s.SaleItems).LoadAsync(ct);
            RecalculateOpenOrderTotals(primarySale);
            primarySale.UpdatedAt = now;

            await db.SaveChangesAsync(ct);
            await txn.CommitAsync(ct);

            return (await GetByIdAsync(primarySaleId, ct))!;
        }
        catch
        {
            await txn.RollbackAsync(ct);
            throw;
        }
    }

    // ── Stock helpers ──────────────────────────────────────────────────────────

    private Task DeductStockForItemsAsync(IEnumerable<SaleItem> items, CancellationToken ct)
        => AdjustStockForItemsAsync(items, -1, ct);

    private Task RestoreStockForItemsAsync(IEnumerable<SaleItem> items, CancellationToken ct)
        => AdjustStockForItemsAsync(items, +1, ct);

    /// <summary>
    /// Adjusts stock for a list of sale items by the given sign (+1 = restore, -1 = deduct).
    /// Skips bundle header rows.
    /// Standard products: adjusts Product.Quantity directly.
    /// Combo products: adjusts component product quantities via ComboItems.
    /// Must be called before SaveChangesAsync.
    /// </summary>
    private async Task AdjustStockForItemsAsync(IEnumerable<SaleItem> items, int sign, CancellationToken ct)
    {
        // Single-pass partition into standard vs combo items
        var standardItems = new List<SaleItem>();
        var comboItems    = new List<SaleItem>();
        foreach (var i in items.Where(i => !i.IsBundleHeader && i.Product is not null))
        {
            if (i.Product!.ProductType == ProductTypes.Combo && i.ProductId.HasValue)
                comboItems.Add(i);
            else
                standardItems.Add(i);
        }

        // Standard products: adjust own stock
        foreach (var item in standardItems)
        {
            item.Product!.Quantity += sign * item.Quantity;
            item.Product.UpdatedAt  = DateTime.UtcNow;
        }

        // Combo products: adjust component stock
        if (comboItems.Count > 0)
        {
            var comboProductIds = comboItems.Select(i => i.ProductId!.Value).Distinct().ToList();

            var comboDefs = await db.ComboItems
                .Where(ci => comboProductIds.Contains(ci.ComboProductId))
                .Include(ci => ci.ComponentProduct)
                .ToListAsync(ct);

            // Pre-group by combo product ID for O(1) lookup
            var comboDefsByProductId = comboDefs
                .GroupBy(ci => ci.ComboProductId)
                .ToDictionary(g => g.Key, g => g.ToList());

            foreach (var item in comboItems)
            {
                if (!comboDefsByProductId.TryGetValue(item.ProductId!.Value, out var comps)) continue;
                foreach (var comp in comps)
                {
                    if (comp.ComponentProduct is not null)
                    {
                        comp.ComponentProduct.Quantity += sign * (int)(comp.Quantity * item.Quantity);
                        comp.ComponentProduct.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }
        }
    }

    // ── RecalculateOpenOrderTotals ─────────────────────────────────────────────
    // Recomputes SubTotal, Total, RoundedTotal on an open order without deducting stock.
    // Call this after adding, updating, or voiding items on an open order.
    // The Sale entity must have SaleItems already loaded (tracked).
    private static void RecalculateOpenOrderTotals(Sale sale)
    {
        // For open orders, no bill-level discount applies yet (that comes at settlement).
        // Sum non-voided, non-bundle-sub-item rows only.
        decimal subTotal = 0m;
        foreach (var item in sale.SaleItems.Where(i => !i.IsVoided && i.BundleHeaderSaleItemId == null))
        {
            decimal effectivePrice = item.OverriddenPrice ?? item.Price;
            decimal lineTotal = Math.Round(effectivePrice * item.Quantity, 2);

            if (item.ItemDiscount > 0)
            {
                decimal itemLevelDiscount = item.ItemDiscountType == DiscountTypes.Percentage
                    ? Math.Round(lineTotal * item.ItemDiscount / 100m, 2)
                    : item.ItemDiscount;
                lineTotal = Math.Max(0m, lineTotal - itemLevelDiscount);
            }

            subTotal += lineTotal;
        }

        sale.SubTotal    = Math.Round(subTotal, 2);
        sale.Total       = sale.SubTotal;
        sale.RoundedTotal = sale.SubTotal;
        sale.Due         = sale.SubTotal;
    }

    // ── Rounding helpers ───────────────────────────────────────────────────────

    private async Task<(bool Enabled, decimal Quantum)> GetRoundingSettingsAsync(CancellationToken ct)
    {
        var rows = await db.Settings
            .AsNoTracking()
            .Where(s => s.Key == "rounding_enabled" || s.Key == "rounding_quantum")
            .ToListAsync(ct);

        var enabledRow = rows.FirstOrDefault(r => r.Key == "rounding_enabled");
        var quantumRow = rows.FirstOrDefault(r => r.Key == "rounding_quantum");

        bool enabled = enabledRow?.Value == "true";
        decimal quantum = quantumRow?.Value switch
        {
            "0.10" => 0.10m,
            _      => 0.05m,
        };

        return (enabled, quantum);
    }

    private static (decimal RoundedTotal, decimal Adjustment) ApplyCashRounding(decimal total, decimal quantum)
    {
        int totalCents   = (int)Math.Round(total   * 100m, MidpointRounding.AwayFromZero);
        int quantumUnits = (int)Math.Round(quantum * 100m, MidpointRounding.AwayFromZero);
        int remainder    = totalCents % quantumUnits;
        int roundedCents = remainder * 2 < quantumUnits
            ? totalCents - remainder
            : totalCents + (quantumUnits - remainder);
        decimal roundedTotal = roundedCents / 100m;
        decimal adjustment   = roundedTotal - total;
        return (roundedTotal, adjustment);
    }
}
