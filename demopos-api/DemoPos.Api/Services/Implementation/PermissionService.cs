using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Permissions;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class PermissionService(AppDbContext db, IMapper mapper) : IPermissionService
{
    // ── GetAll ─────────────────────────────────────────────────────────────────

    public async Task<List<PermissionDto>> GetAllAsync(CancellationToken ct = default)
    {
        var permissions = await db.Permissions
            .AsNoTracking()
            .OrderBy(p => p.Id)
            .ToListAsync(ct);

        return mapper.Map<List<PermissionDto>>(permissions);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public async Task<PermissionDto> CreateAsync(CreatePermissionRequest req, CancellationToken ct = default)
    {
        var baseName = req.Name.Trim().ToLowerInvariant();

        if (req.Type == 2)
        {
            // Create four CRUD variant permissions: {name}_view, _create, _update, _delete.
            var suffixes = new[] { "view", "create", "update", "delete" };
            var names = suffixes.Select(s => $"{baseName}_{s}").ToList();

            // Check for any existing conflicts before inserting any row.
            var conflicts = await db.Permissions
                .Where(p => names.Contains(p.Name.ToLower()))
                .Select(p => p.Name)
                .ToListAsync(ct);

            if (conflicts.Count > 0)
                throw new ArgumentException(
                    $"The following permissions already exist: {string.Join(", ", conflicts)}");

            var newPermissions = names
                .Select(n => new Permission { Name = n })
                .ToList();

            db.Permissions.AddRange(newPermissions);
            await db.SaveChangesAsync(ct);

            // Return the first created permission (the _view variant) as the canonical response.
            // The controller can decide how to present bulk creation results.
            return mapper.Map<PermissionDto>(newPermissions[0]);
        }
        else
        {
            // Type = 1 (default): create a single permission.
            if (await db.Permissions.AnyAsync(p => p.Name.ToLower() == baseName, ct))
                throw new ArgumentException($"A permission named '{baseName}' already exists");

            var permission = new Permission { Name = baseName };
            db.Permissions.Add(permission);
            await db.SaveChangesAsync(ct);

            return mapper.Map<PermissionDto>(permission);
        }
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public async Task<PermissionDto> UpdateAsync(int id, UpdatePermissionRequest req, CancellationToken ct = default)
    {
        var permission = await db.Permissions
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new KeyNotFoundException("Permission not found");

        var newName = req.Name.Trim().ToLowerInvariant();

        if (await db.Permissions.AnyAsync(p => p.Name.ToLower() == newName && p.Id != id, ct))
            throw new ArgumentException($"A permission named '{newName}' already exists");

        permission.Name = newName;
        await db.SaveChangesAsync(ct);

        return mapper.Map<PermissionDto>(permission);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var permission = await db.Permissions
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new KeyNotFoundException("Permission not found");

        // Remove all RolePermission rows referencing this permission before
        // deleting the permission itself (SQLite FK enforcement).
        var assignments = await db.RolePermissions
            .Where(rp => rp.PermissionId == id)
            .ToListAsync(ct);

        if (assignments.Count > 0)
            db.RolePermissions.RemoveRange(assignments);

        db.Permissions.Remove(permission);
        await db.SaveChangesAsync(ct);
    }
}
