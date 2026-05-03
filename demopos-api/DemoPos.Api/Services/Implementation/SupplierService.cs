using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Suppliers;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class SupplierService(AppDbContext db, IMapper mapper) : ISupplierService
{
    public async Task<(IEnumerable<SupplierDto> Items, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? search,
        CancellationToken ct = default)
    {
        var query = db.Suppliers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s =>
                s.Name.ToLower().Contains(term) ||
                (s.Phone != null && s.Phone.Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);

        var suppliers = await query
            .OrderBy(s => s.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (mapper.Map<List<SupplierDto>>(suppliers), totalCount);
    }

    public async Task<IEnumerable<SupplierDto>> GetAllAsync(string? search, CancellationToken ct = default)
    {
        var query = db.Suppliers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s =>
                s.Name.ToLower().Contains(term) ||
                (s.Phone != null && s.Phone.Contains(term)));
        }

        var suppliers = await query
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

        return mapper.Map<List<SupplierDto>>(suppliers);
    }

    public async Task<IEnumerable<SupplierDto>> GetAllListAsync(CancellationToken ct = default)
    {
        var suppliers = await db.Suppliers
            .AsNoTracking()
            .OrderBy(s => s.Name)
            .ToListAsync(ct);

        return mapper.Map<List<SupplierDto>>(suppliers);
    }

    public async Task<SupplierDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var supplier = await db.Suppliers
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        return supplier is null ? null : mapper.Map<SupplierDto>(supplier);
    }

    public async Task<SupplierDto> CreateAsync(CreateSupplierRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Supplier name is required.");

        if (!string.IsNullOrWhiteSpace(request.Phone) &&
            await PhoneExistsAsync(request.Phone.Trim(), null, ct))
            throw new ArgumentException("A supplier with that phone number already exists.");

        var supplier = new Supplier
        {
            Name = request.Name.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.Suppliers.Add(supplier);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("UNIQUE") == true)
        {
            throw new ArgumentException("A supplier with that phone number already exists.");
        }

        return mapper.Map<SupplierDto>(supplier);
    }

    public async Task<SupplierDto> UpdateAsync(int id, UpdateSupplierRequest request, CancellationToken ct = default)
    {
        if (id == 1)
            throw new InvalidOperationException("Cannot modify the default supplier.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Supplier name is required.");

        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new KeyNotFoundException("Supplier not found.");

        if (!string.IsNullOrWhiteSpace(request.Phone) &&
            await PhoneExistsAsync(request.Phone.Trim(), id, ct))
            throw new ArgumentException("A supplier with that phone number already exists.");

        supplier.Name = request.Name.Trim();
        supplier.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        supplier.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        supplier.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("UNIQUE") == true)
        {
            throw new ArgumentException("A supplier with that phone number already exists.");
        }

        return mapper.Map<SupplierDto>(supplier);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        if (id == 1)
            throw new InvalidOperationException("Cannot delete the default supplier.");

        var supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw new KeyNotFoundException("Supplier not found.");

        db.Suppliers.Remove(supplier);
        await db.SaveChangesAsync(ct);

        return true;
    }

    public async Task<bool> PhoneExistsAsync(string phone, int? excludeId = null, CancellationToken ct = default)
    {
        return await db.Suppliers
            .AsNoTracking()
            .AnyAsync(s => s.Phone == phone && (excludeId == null || s.Id != excludeId), ct);
    }
}
