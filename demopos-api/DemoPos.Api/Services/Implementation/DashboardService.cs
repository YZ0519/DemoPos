using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Dashboard;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class DashboardService(AppDbContext db) : IDashboardService
{
    private static readonly string[] MonthLabels =
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    public async Task<DashboardDto> GetDashboardAsync(
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct = default)
    {
        // ── Default range: last 30 days ────────────────────────────────────────
        var utcNow     = DateTime.UtcNow;
        var rangeEnd   = dateTo?.ToUniversalTime().Date.AddDays(1)
                         ?? utcNow.Date.AddDays(1);       // exclusive upper bound
        var rangeStart = dateFrom?.ToUniversalTime().Date
                         ?? utcNow.Date.AddDays(-29);     // inclusive lower bound (30 days incl. today)

        int currentYear = utcNow.Year;
        var yearStart   = new DateTime(currentYear,     1, 1, 0, 0, 0, DateTimeKind.Utc);
        var yearEnd     = new DateTime(currentYear + 1, 1, 1, 0, 0, 0, DateTimeKind.Utc); // exclusive

        // ── Run queries sequentially — EF Core DbContext is not thread-safe ─────
        // Task.WhenAll on the same DbContext causes "second operation started"
        // errors; await each query individually instead.
        var salesAgg = await db.Sales.AsNoTracking()
            .GroupBy(_ => 1)
            .Select(g => new
            {
                SubTotal = g.Sum(s => (decimal?)s.SubTotal)      ?? 0m,
                Discount = g.Sum(s => (decimal?)s.Discount)      ?? 0m,
                Total    = g.Sum(s => (decimal?)(s.RoundedTotal > 0 ? s.RoundedTotal : s.Total)) ?? 0m,
                Due      = g.Sum(s => (decimal?)s.Due)           ?? 0m,
            })
            .FirstOrDefaultAsync(ct);

        var saleSubTotal = salesAgg?.SubTotal ?? 0m;
        var saleDiscount = salesAgg?.Discount ?? 0m;
        var saleTotal    = salesAgg?.Total    ?? 0m;
        var saleDue      = salesAgg?.Due      ?? 0m;

        // Exclude id=1 (Walking Customer) from the real customer count
        var totalCustomers = await db.Customers.AsNoTracking()
            .CountAsync(c => c.Id != 1, ct);

        var totalProducts = await db.Products.AsNoTracking()
            .CountAsync(p => p.Status, ct);

        var totalOrders = await db.Sales.AsNoTracking()
            .CountAsync(ct);

        var totalSaleItems = await db.SaleItems.AsNoTracking()
            .SumAsync(si => (int?)si.Quantity, ct) ?? 0;

        // Daily chart — SaleTransactions grouped by date within range
        var dailyRawRows = await db.SaleTransactions
            .AsNoTracking()
            .Where(t => t.CreatedAt >= rangeStart && t.CreatedAt < rangeEnd)
            .Select(t => new { t.CreatedAt, t.Amount })
            .ToListAsync(ct);

        // Monthly chart — current-year SaleTransactions, all 12 months
        var monthlyRawRows = await db.SaleTransactions
            .AsNoTracking()
            .Where(t => t.CreatedAt >= yearStart && t.CreatedAt < yearEnd)
            .Select(t => new { t.CreatedAt.Month, t.Amount })
            .ToListAsync(ct);

        // ── Daily chart ────────────────────────────────────────────────────────
        // Aggregates SaleTransaction.Amount (cash received per PRD REQ-DASH-002).
        var dailyChart = dailyRawRows
            .GroupBy(t => t.CreatedAt.Date)
            .OrderBy(g => g.Key)
            .Select(g => new DailyChartPoint(
                g.Key.ToString("yyyy-MM-dd"),
                Math.Round(g.Sum(t => t.Amount), 2)))
            .ToList();

        // ── Monthly chart ──────────────────────────────────────────────────────
        // NOTE: Chart aggregates SaleTransaction.Amount (cash received), not Sale.Total
        // (billed amount). This matches the source PHP DashboardController and PRD
        // REQ-DASH-003 which specifies "order_transactions aggregated by month".
        var monthlyLookup = monthlyRawRows
            .GroupBy(t => t.Month)
            .ToDictionary(g => g.Key, g => Math.Round(g.Sum(t => t.Amount), 2));

        var monthlyChart = Enumerable.Range(1, 12)
            .Select(m => new MonthlyChartPoint(
                m,
                MonthLabels[m - 1],
                monthlyLookup.TryGetValue(m, out var total) ? total : 0m))
            .ToList();

        return new DashboardDto
        {
            SaleSubTotal   = Math.Round(saleSubTotal, 2),
            SaleDiscount   = Math.Round(saleDiscount, 2),
            SaleTotal      = Math.Round(saleTotal,    2),
            SaleDue        = Math.Round(saleDue,      2),
            TotalCustomers = totalCustomers,
            TotalProducts  = totalProducts,
            TotalOrders    = totalOrders,
            TotalSaleItems = totalSaleItems,
            DailyChart     = dailyChart,
            MonthlyChart   = monthlyChart,
        };
    }
}
