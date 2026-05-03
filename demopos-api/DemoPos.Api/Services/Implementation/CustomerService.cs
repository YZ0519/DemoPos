using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Customers;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class CustomerService(AppDbContext db, IMapper mapper) : ICustomerService
{
    public async Task<(IEnumerable<CustomerDto> Items, int TotalCount)> GetPagedAsync(
        int page,
        int pageSize,
        string? search,
        CancellationToken ct = default)
    {
        var query = db.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(term) ||
                (c.Phone != null && c.Phone.Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);

        var customers = await query
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (mapper.Map<List<CustomerDto>>(customers), totalCount);
    }

    public async Task<IEnumerable<CustomerSearchDto>> SearchAsync(
        string? q,
        int limit,
        CancellationToken ct = default)
    {
        var query = db.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(term) ||
                (c.Phone != null && c.Phone.Contains(term)));
        }

        return await query
            .OrderBy(c => c.Name)
            .Take(limit)
            .Select(c => new CustomerSearchDto
            {
                Id = c.Id,
                Name = c.Name,
                Phone = c.Phone,
            })
            .ToListAsync(ct);
    }

    public async Task<IEnumerable<CustomerDto>> GetAllAsync(string? search, CancellationToken ct = default)
    {
        var query = db.Customers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(term) ||
                (c.Phone != null && c.Phone.Contains(term)));
        }

        var customers = await query
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        return mapper.Map<List<CustomerDto>>(customers);
    }

    public async Task<IEnumerable<CustomerDto>> GetAllListAsync(CancellationToken ct = default)
    {
        var customers = await db.Customers
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .ToListAsync(ct);

        return mapper.Map<List<CustomerDto>>(customers);
    }

    public async Task<CustomerDto?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var customer = await db.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id, ct);

        return customer is null ? null : mapper.Map<CustomerDto>(customer);
    }

    public async Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Customer name is required.");

        if (!string.IsNullOrWhiteSpace(request.Phone) &&
            await PhoneExistsAsync(request.Phone.Trim(), null, ct))
            throw new ArgumentException("A customer with that phone number already exists.");

        var customer = new Customer
        {
            Name = request.Name.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        db.Customers.Add(customer);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("UNIQUE") == true)
        {
            throw new ArgumentException("A customer with that phone number already exists.");
        }

        return mapper.Map<CustomerDto>(customer);
    }

    public async Task<CustomerDto> UpdateAsync(int id, UpdateCustomerRequest request, CancellationToken ct = default)
    {
        if (id == 1)
            throw new InvalidOperationException("Cannot modify the default customer.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("Customer name is required.");

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new KeyNotFoundException("Customer not found.");

        if (!string.IsNullOrWhiteSpace(request.Phone) &&
            await PhoneExistsAsync(request.Phone.Trim(), id, ct))
            throw new ArgumentException("A customer with that phone number already exists.");

        customer.Name = request.Name.Trim();
        customer.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        customer.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        customer.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("UNIQUE") == true)
        {
            throw new ArgumentException("A customer with that phone number already exists.");
        }

        return mapper.Map<CustomerDto>(customer);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        if (id == 1)
            throw new InvalidOperationException("Cannot delete the default customer.");

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new KeyNotFoundException("Customer not found.");

        db.Customers.Remove(customer);
        await db.SaveChangesAsync(ct);

        return true;
    }

    public async Task<bool> PhoneExistsAsync(string phone, int? excludeId = null, CancellationToken ct = default)
    {
        return await db.Customers
            .AsNoTracking()
            .AnyAsync(c => c.Phone == phone && (excludeId == null || c.Id != excludeId), ct);
    }
}
