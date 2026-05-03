using DemoPos.Api.DTOs.Dashboard;

namespace DemoPos.Api.Services.Abstraction;

public interface IDashboardService
{
    /// <summary>
    /// Returns dashboard summary cards and chart data.
    /// <paramref name="dateFrom"/> and <paramref name="dateTo"/> filter the daily chart only.
    /// Summary card totals are always all-time.
    /// Defaults to last 30 days when null.
    /// </summary>
    Task<DashboardDto> GetDashboardAsync(
        DateTime? dateFrom,
        DateTime? dateTo,
        CancellationToken ct = default);
}
