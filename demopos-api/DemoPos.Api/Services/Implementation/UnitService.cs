using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Units;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class UnitService(AppDbContext db, IMapper mapper) : IUnitService
{
    public async Task<List<UnitDto>> GetAllAsync(CancellationToken ct = default)
    {
        var units = await db.Units
            .AsNoTracking()
            .OrderBy(u => u.Title)
            .ToListAsync(ct);

        return mapper.Map<List<UnitDto>>(units);
    }

    public async Task<UnitDto> CreateAsync(CreateUnitRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Unit title is required");

        if (string.IsNullOrWhiteSpace(request.ShortName))
            throw new ArgumentException("Unit short name is required");

        if (await db.Units.AnyAsync(u => u.Title == request.Title.Trim(), ct))
            throw new ArgumentException("A unit with that title already exists");

        var unit = new Unit
        {
            Title = request.Title.Trim(),
            ShortName = request.ShortName.Trim(),
        };

        db.Units.Add(unit);
        await db.SaveChangesAsync(ct);

        return mapper.Map<UnitDto>(unit);
    }

    public async Task<UnitDto> UpdateAsync(int id, UpdateUnitRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            throw new ArgumentException("Unit title is required");

        if (string.IsNullOrWhiteSpace(request.ShortName))
            throw new ArgumentException("Unit short name is required");

        var unit = await db.Units.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("Unit not found");

        if (await db.Units.AnyAsync(u => u.Title == request.Title.Trim() && u.Id != id, ct))
            throw new ArgumentException("A unit with that title already exists");

        unit.Title = request.Title.Trim();
        unit.ShortName = request.ShortName.Trim();
        unit.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return mapper.Map<UnitDto>(unit);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var unit = await db.Units.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new KeyNotFoundException("Unit not found");

        db.Units.Remove(unit);
        await db.SaveChangesAsync(ct);
    }
}
