using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Reports;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class ReportService(AppDbContext db) : IReportService
{
    // ── GetSaleReportAsync ─────────────────────────────────────────────────────
    public async Task<SaleReportDto> GetSaleReportAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken ct = default)
    {
        var utcStart = startDate.ToUniversalTime().Date;
        var utcEnd   = endDate.ToUniversalTime().Date.AddDays(1); // exclusive

        // Project directly inside the EF query so only the required columns are
        // fetched from the DB — avoids loading full entity + navigation objects.
        var items = await db.Sales
            .AsNoTracking()
            .Where(s => s.CreatedAt >= utcStart && s.CreatedAt < utcEnd)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SaleReportItemDto
            {
                Id                 = s.Id,
                CustomerName       = s.Customer != null ? s.Customer.Name : string.Empty,
                SubTotal           = s.SubTotal,
                Discount           = s.Discount,
                Total              = s.Total,
                RoundingAdjustment = s.RoundingAdjustment,
                RoundedTotal       = s.RoundedTotal,
                Paid               = s.Paid,
                Due                = s.Due,
                Status             = s.Status == 1 ? "Paid" : "Due",
                CreatedAt          = s.CreatedAt,
                // EF Core translates the nested collection + Product LEFT JOIN to a
                // single query — this is not an N+1.
                SaleItems          = s.SaleItems
                    .Where(si => !si.IsVoided && si.BundleHeaderSaleItemId == null)
                    .Select(si => new SaleReportLineItemDto
                    {
                        ProductName  = si.Product != null ? si.Product.Name : string.Empty,
                        ProductSku   = si.Product != null ? si.Product.Sku  : null,
                        Quantity     = si.Quantity,
                        UnitPrice    = si.Price,
                        Total        = si.Total,
                        ModifierNote = si.ModifierNote,
                    })
                    .ToList(),
            })
            .ToListAsync(ct);

        return new SaleReportDto
        {
            Items         = items,
            TotalSubTotal = Math.Round(items.Sum(i => i.SubTotal),     2),
            TotalDiscount = Math.Round(items.Sum(i => i.Discount),     2),
            TotalPaid     = Math.Round(items.Sum(i => i.Paid),         2),
            TotalDue      = Math.Round(items.Sum(i => i.Due),          2),
            GrandTotal    = Math.Round(items.Sum(i => i.RoundedTotal), 2),
        };
    }

    // ── GetSaleSummaryAsync ────────────────────────────────────────────────────
    public async Task<SaleSummaryReportDto> GetSaleSummaryAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken ct = default)
    {
        var utcStart = startDate.ToUniversalTime().Date;
        var utcEnd   = endDate.ToUniversalTime().Date.AddDays(1); // exclusive

        var query = db.Sales
            .AsNoTracking()
            .Where(s => s.CreatedAt >= utcStart && s.CreatedAt < utcEnd);

        // Single SQL query to ensure all aggregates are consistent (avoids
        // inter-query race conditions if a sale is inserted between calls).
        var agg = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                SubTotal     = g.Sum(s => (decimal?)s.SubTotal)      ?? 0m,
                Discount     = g.Sum(s => (decimal?)s.Discount)      ?? 0m,
                Paid         = g.Sum(s => (decimal?)s.Paid)          ?? 0m,
                Due          = g.Sum(s => (decimal?)s.Due)           ?? 0m,
                Total        = g.Sum(s => (decimal?)s.Total)         ?? 0m,
                RoundedTotal = g.Sum(s => (decimal?)s.RoundedTotal)  ?? 0m,
                OrderCount   = g.Count(),
            })
            .FirstOrDefaultAsync(ct);

        var subTotal   = agg?.SubTotal     ?? 0m;
        var discount   = agg?.Discount     ?? 0m;
        var paid       = agg?.Paid         ?? 0m;
        var due        = agg?.Due          ?? 0m;
        var total      = agg?.RoundedTotal ?? 0m;
        var orderCount = agg?.OrderCount   ?? 0;

        return new SaleSummaryReportDto
        {
            SubTotal   = Math.Round(subTotal,  2),
            Discount   = Math.Round(discount,  2),
            Paid       = Math.Round(paid,      2),
            Due        = Math.Round(due,       2),
            Total      = Math.Round(total,     2),
            OrderCount = orderCount,
        };
    }

    // ── GetPurchaseReportAsync ─────────────────────────────────────────────────
    public async Task<PurchaseReportDto> GetPurchaseReportAsync(
        DateTime startDate,
        DateTime endDate,
        CancellationToken ct = default)
    {
        var utcStart = startDate.ToUniversalTime().Date;
        var utcEnd   = endDate.ToUniversalTime().Date.AddDays(1); // exclusive

        // Project directly inside the EF query so only the required columns are
        // fetched from the DB — avoids loading full entity + Supplier navigation.
        // RoundedTotal and RoundingAdjustment are included so totals can be
        // computed from the projected list without a second query.
        var items = await db.Purchases
            .AsNoTracking()
            .Where(p => p.Date >= utcStart && p.Date < utcEnd)
            .OrderByDescending(p => p.Date)
            .Select(p => new PurchaseReportItemDto
            {
                Id                 = p.Id,
                SupplierName       = p.Supplier != null ? p.Supplier.Name : string.Empty,
                SubTotal           = p.SubTotal,
                Tax                = p.Tax,
                Discount           = p.Discount,
                Shipping           = p.Shipping,
                GrandTotal         = p.GrandTotal,
                RoundedTotal       = p.RoundedTotal,
                RoundingAdjustment = p.RoundingAdjustment,
                Date               = p.Date,
                CreatedAt          = p.CreatedAt,
                // EF Core translates the nested collection + Product LEFT JOIN to a
                // single query — this is not an N+1.
                PurchaseItems      = p.PurchaseItems
                    .Select(pi => new PurchaseReportLineItemDto
                    {
                        ProductName = pi.Product != null ? pi.Product.Name : string.Empty,
                        ProductSku  = pi.Product != null ? pi.Product.Sku  : null,
                        Quantity    = pi.Quantity,
                        UnitCost    = pi.PurchasePrice,
                        Total       = pi.PurchasePrice * pi.Quantity,
                    })
                    .ToList(),
            })
            .ToListAsync(ct);

        return new PurchaseReportDto
        {
            Items                   = items,
            TotalSubTotal           = Math.Round(items.Sum(i => i.SubTotal),           2),
            TotalTax                = Math.Round(items.Sum(i => i.Tax),                2),
            TotalDiscount           = Math.Round(items.Sum(i => i.Discount),           2),
            TotalShipping           = Math.Round(items.Sum(i => i.Shipping),           2),
            GrandTotal              = Math.Round(items.Sum(i => i.RoundedTotal),       2),
            TotalRoundingAdjustment = Math.Round(items.Sum(i => i.RoundingAdjustment), 2),
            Count                   = items.Count,
        };
    }

    // ── GetProfitLossAsync ─────────────────────────────────────────────────────
    public async Task<ProfitLossReportDto> GetProfitLossAsync(
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct = default)
    {
        var utcNow   = DateTime.UtcNow;
        var utcStart = (dateFrom ?? utcNow.AddDays(-29)).ToUniversalTime().Date;
        var utcEnd   = (dateTo   ?? utcNow).ToUniversalTime().Date.AddDays(1); // exclusive

        // Project per-sale revenue and COGS directly inside the EF query.
        // SaleItem.Price = selling price at time of sale; SaleItem.PurchasePrice = COGS.
        // Returned sales are excluded from the P&L to avoid counting reversed revenue.
        var items = await db.Sales
            .AsNoTracking()
            .Where(s => s.CreatedAt >= utcStart && s.CreatedAt < utcEnd && !s.IsReturned)
            .Select(s => new ProfitLossItemDto
            {
                SaleId    = s.Id,
                SaleDate  = s.CreatedAt,
                Revenue   = s.SaleItems.Sum(i => (decimal?)i.Price * i.Quantity) ?? 0m,
                Cogs      = s.SaleItems.Sum(i => (decimal?)i.PurchasePrice * i.Quantity) ?? 0m,
                // GrossProfit and MarginPercent computed in-memory after materialisation
                // to avoid EF translation issues with conditional division.
                GrossProfit   = 0m,
                MarginPercent = 0m,
            })
            .ToListAsync(ct);

        // Compute derived fields in-memory
        foreach (var item in items)
        {
            item.Revenue      = Math.Round(item.Revenue, 2);
            item.Cogs         = Math.Round(item.Cogs, 2);
            item.GrossProfit  = Math.Round(item.Revenue - item.Cogs, 2);
            item.MarginPercent = item.Revenue > 0
                ? Math.Round(item.GrossProfit / item.Revenue * 100, 2)
                : 0m;
        }

        var totalRevenue  = Math.Round(items.Sum(i => i.Revenue), 2);
        var totalCogs     = Math.Round(items.Sum(i => i.Cogs), 2);
        var grossProfit   = Math.Round(totalRevenue - totalCogs, 2);

        // Fetch total discount separately to avoid re-joining items
        var totalDiscount = await db.Sales
            .AsNoTracking()
            .Where(s => s.CreatedAt >= utcStart && s.CreatedAt < utcEnd && !s.IsReturned)
            .SumAsync(s => (decimal?)s.Discount, ct) ?? 0m;

        return new ProfitLossReportDto
        {
            TotalRevenue       = totalRevenue,
            TotalCogs          = totalCogs,
            GrossProfit        = grossProfit,
            GrossMarginPercent = totalRevenue > 0
                ? Math.Round(grossProfit / totalRevenue * 100, 2)
                : 0m,
            TotalDiscount      = Math.Round(totalDiscount, 2),
            Items              = items,
        };
    }

    // ── GetInventoryReportAsync ────────────────────────────────────────────────
    public async Task<List<InventoryReportItemDto>> GetInventoryReportAsync(
        CancellationToken ct = default)
    {
        var products = await db.Products
            .AsNoTracking()
            .Include(p => p.Unit)
            .Where(p => p.Status)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        return products.Select(p => new InventoryReportItemDto
        {
            Id              = p.Id,
            Name            = p.Name,
            Sku             = p.Sku,
            Price           = p.Price,
            DiscountedPrice = p.DiscountedPrice,
            HasDiscount     = p.Discount.HasValue && p.Discount.Value > 0,
            Quantity        = p.Quantity,
            UnitShortName   = p.Unit?.ShortName ?? string.Empty,
        }).ToList();
    }
}
