using DemoPos.Api.DTOs.RestaurantTable;

namespace DemoPos.Api.Services.Abstraction;

public interface ITableService
{
    /// <summary>
    /// Returns all tables (active and inactive) ordered by SortOrder then Number.
    /// </summary>
    Task<IEnumerable<RestaurantTableDto>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Returns only active tables for use in POS/dine-in dropdowns.
    /// </summary>
    Task<IEnumerable<RestaurantTableDto>> GetActiveAsync(CancellationToken ct = default);

    /// <summary>
    /// Creates a new restaurant table.
    /// Throws <see cref="ArgumentException"/> if a table with the same Number already exists.
    /// </summary>
    Task<RestaurantTableDto> CreateAsync(CreateTableRequest req, CancellationToken ct = default);

    /// <summary>
    /// Updates an existing restaurant table.
    /// Throws <see cref="KeyNotFoundException"/> if the table is not found.
    /// Throws <see cref="ArgumentException"/> if another table already has the same Number.
    /// </summary>
    Task<RestaurantTableDto> UpdateAsync(int id, UpdateTableRequest req, CancellationToken ct = default);

    /// <summary>
    /// Deletes a restaurant table.
    /// Throws <see cref="KeyNotFoundException"/> if the table is not found.
    /// Throws <see cref="InvalidOperationException"/> if the table is currently occupied.
    /// Throws <see cref="InvalidOperationException"/> if the table has existing sales records.
    /// </summary>
    Task DeleteAsync(int id, CancellationToken ct = default);

    /// <summary>
    /// Updates the live status of a table ("available" | "occupied").
    /// Called internally by SaleService when a dine-in order is opened or closed.
    /// Throws <see cref="KeyNotFoundException"/> if the table is not found.
    /// </summary>
    Task SetStatusAsync(int id, string status, CancellationToken ct = default);
}
