using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Constants;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.RestaurantTable;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class TableService(AppDbContext db, IMapper mapper) : ITableService
{
    // ── GetAllAsync ────────────────────────────────────────────────────────────
    public async Task<IEnumerable<RestaurantTableDto>> GetAllAsync(
        CancellationToken ct = default)
    {
        var tables = await db.RestaurantTables
            .AsNoTracking()
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Number)
            .ToListAsync(ct);

        return mapper.Map<List<RestaurantTableDto>>(tables);
    }

    // ── GetActiveAsync ─────────────────────────────────────────────────────────
    public async Task<IEnumerable<RestaurantTableDto>> GetActiveAsync(
        CancellationToken ct = default)
    {
        var tables = await db.RestaurantTables
            .AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Number)
            .ToListAsync(ct);

        return mapper.Map<List<RestaurantTableDto>>(tables);
    }

    // ── CreateAsync ────────────────────────────────────────────────────────────
    public async Task<RestaurantTableDto> CreateAsync(
        CreateTableRequest req,
        CancellationToken ct = default)
    {
        // Guard: table numbers must be unique so staff can identify them unambiguously
        var duplicate = await db.RestaurantTables
            .AsNoTracking()
            .AnyAsync(t => t.Number == req.Number, ct);

        if (duplicate)
            throw new ArgumentException(
                $"A table with number {req.Number} already exists.");

        var table = new RestaurantTable
        {
            Number    = req.Number,
            Label     = req.Label?.Trim(),
            Capacity  = req.Capacity,
            SortOrder = req.SortOrder,
            IsActive  = req.IsActive,
            Status    = TableStatuses.Available,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.RestaurantTables.Add(table);
        await db.SaveChangesAsync(ct);

        return mapper.Map<RestaurantTableDto>(table);
    }

    // ── UpdateAsync ────────────────────────────────────────────────────────────
    public async Task<RestaurantTableDto> UpdateAsync(
        int id,
        UpdateTableRequest req,
        CancellationToken ct = default)
    {
        var table = await db.RestaurantTables
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException($"Table {id} not found.");

        // Guard: ensure the new number is not taken by a different table
        var duplicate = await db.RestaurantTables
            .AsNoTracking()
            .AnyAsync(t => t.Number == req.Number && t.Id != id, ct);

        if (duplicate)
            throw new ArgumentException(
                $"A table with number {req.Number} already exists.");

        table.Number    = req.Number;
        table.Label     = req.Label?.Trim();
        table.Capacity  = req.Capacity;
        table.SortOrder = req.SortOrder;
        table.IsActive  = req.IsActive;
        table.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return mapper.Map<RestaurantTableDto>(table);
    }

    // ── DeleteAsync ────────────────────────────────────────────────────────────
    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var table = await db.RestaurantTables
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException($"Table {id} not found.");

        // Guard: cannot delete a table that still has a guest seated
        if (table.Status == TableStatuses.Occupied)
            throw new InvalidOperationException("Table is currently occupied.");

        // Guard: preserve historical sale records — deactivate instead of deleting
        var hasSales = await db.Sales
            .AsNoTracking()
            .AnyAsync(s => s.TableId == id, ct);

        if (hasSales)
            throw new InvalidOperationException("Table has existing sales records.");

        db.RestaurantTables.Remove(table);
        await db.SaveChangesAsync(ct);
    }

    // ── SetStatusAsync ─────────────────────────────────────────────────────────
    public async Task SetStatusAsync(
        int id,
        string status,
        CancellationToken ct = default)
    {
        var table = await db.RestaurantTables
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new KeyNotFoundException($"Table {id} not found.");

        table.Status    = status;
        table.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
    }
}
