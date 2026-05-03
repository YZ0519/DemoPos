using AutoMapper;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;
using DemoPos.Api.DTOs.Roles;
using DemoPos.Api.Models;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Services.Implementation;

public class RoleService(AppDbContext db, IMapper mapper) : IRoleService
{
    // The seeded Admin role is always id=1.  Keeping this as a named constant
    // makes the guard clauses below self-documenting.
    private const int AdminRoleId   = 1;
    private const string AdminRoleName = "Admin";

    // The seeded User role is always id=2.
    private const int UserRoleId = 2;

    /// <summary>
    /// Permissions that may never be assigned to the built-in User role.
    /// Prevents privilege escalation via the public admin account on the demo site.
    /// </summary>
    private static readonly HashSet<string> AdminOnlyPermissions = new(StringComparer.OrdinalIgnoreCase)
    {
        "user_create",      "user_update",     "user_delete",  "user_suspend",
        "role_create",      "role_update",     "role_delete",
        "permission_view",
        "website_settings", "contact_settings", "invoice_settings",
    };

    // ── GetAll ─────────────────────────────────────────────────────────────────

    public async Task<List<RoleDto>> GetAllAsync(CancellationToken ct = default)
    {
        var roles = await db.Roles
            .AsNoTracking()
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .OrderBy(r => r.Id)
            .ToListAsync(ct);

        return mapper.Map<List<RoleDto>>(roles);
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public async Task<RoleDto> CreateAsync(CreateRoleRequest req, CancellationToken ct = default)
    {
        var name = req.Name.Trim();

        // Case-insensitive duplicate check — the unique index on Role.Name uses
        // the collation of the underlying SQLite file, which is case-sensitive by
        // default, so we must check manually here to give a friendly error message.
        if (await db.Roles.AnyAsync(r => r.Name.ToLower() == name.ToLower(), ct))
            throw new ArgumentException($"A role named '{name}' already exists");

        var role = new Role { Name = name };
        db.Roles.Add(role);
        await db.SaveChangesAsync(ct);

        // Newly created role has no permissions — no need to include the chain.
        return mapper.Map<RoleDto>(role);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public async Task<RoleDto> UpdateAsync(int id, UpdateRoleRequest req, CancellationToken ct = default)
    {
        var role = await db.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new KeyNotFoundException("Role not found");

        if (id == AdminRoleId)
            throw new InvalidOperationException("The Admin role cannot be renamed");

        var name = req.Name.Trim();

        if (await db.Roles.AnyAsync(r => r.Name.ToLower() == name.ToLower() && r.Id != id, ct))
            throw new ArgumentException($"A role named '{name}' already exists");

        role.Name = name;
        role.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return mapper.Map<RoleDto>(role);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        if (id == AdminRoleId)
            throw new InvalidOperationException("The Admin role cannot be deleted");

        var role = await db.Roles
            .FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new KeyNotFoundException("Role not found");

        // SQLite does not cascade deletes through FK constraints by default.
        // Remove child RolePermission rows explicitly before removing the role.
        var childRows = await db.RolePermissions
            .Where(rp => rp.RoleId == id)
            .ToListAsync(ct);

        if (childRows.Count > 0)
            db.RolePermissions.RemoveRange(childRows);

        db.Roles.Remove(role);
        await db.SaveChangesAsync(ct);
    }

    // ── GetPermissions ─────────────────────────────────────────────────────────

    public async Task<List<string>> GetPermissionsAsync(int id, CancellationToken ct = default)
    {
        var exists = await db.Roles.AnyAsync(r => r.Id == id, ct);
        if (!exists)
            throw new KeyNotFoundException("Role not found");

        return await db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.RoleId == id)
            .Select(rp => rp.Permission.Name)
            .ToListAsync(ct);
    }

    // ── SyncPermissions ────────────────────────────────────────────────────────

    public async Task<RoleDto> SyncPermissionsAsync(int id, SyncPermissionsRequest req, CancellationToken ct = default)
    {
        var role = await db.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new KeyNotFoundException("Role not found");

        // Admin role always holds every permission.  Only ensure missing ones are
        // added — never remove any from Admin.
        if (id == AdminRoleId || role.Name.Equals(AdminRoleName, StringComparison.OrdinalIgnoreCase))
        {
            var allPermissions = await db.Permissions.AsNoTracking().ToListAsync(ct);
            var existingPermissionIds = role.RolePermissions.Select(rp => rp.PermissionId).ToHashSet();

            var toAdd = allPermissions
                .Where(p => !existingPermissionIds.Contains(p.Id))
                .Select(p => new RolePermission { RoleId = id, PermissionId = p.Id })
                .ToList();

            if (toAdd.Count > 0)
            {
                db.RolePermissions.AddRange(toAdd);
                await db.SaveChangesAsync(ct);
            }

            // Reload with full navigation chain to build accurate DTO.
            var adminRole = await db.Roles
                .AsNoTracking()
                .Include(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
                .FirstAsync(r => r.Id == id, ct);

            return mapper.Map<RoleDto>(adminRole);
        }

        // For non-Admin roles: replace all permissions with the submitted list.
        // 1. Remove existing assignments.
        if (role.RolePermissions.Count > 0)
            db.RolePermissions.RemoveRange(role.RolePermissions);

        // 2. Resolve submitted permission names to Permission ids.
        //    Unknown names are silently ignored — the client list may be stale.
        //    Admin-only permissions are stripped from the User role to prevent
        //    privilege escalation via the public admin account on the demo site.
        var submittedNames = req.Permissions
            .Select(p => p.Trim().ToLowerInvariant())
            .Where(p => p.Length > 0)
            .Distinct()
            .Where(p => id == AdminRoleId || !AdminOnlyPermissions.Contains(p))
            .ToList();

        if (submittedNames.Count > 0)
        {
            var resolvedPermissions = await db.Permissions
                .AsNoTracking()
                .Where(p => submittedNames.Contains(p.Name.ToLower()))
                .ToListAsync(ct);

            var newAssignments = resolvedPermissions
                .Select(p => new RolePermission { RoleId = id, PermissionId = p.Id })
                .ToList();

            if (newAssignments.Count > 0)
                db.RolePermissions.AddRange(newAssignments);
        }

        await db.SaveChangesAsync(ct);

        // Reload with navigation chain for an accurate DTO.
        var updatedRole = await db.Roles
            .AsNoTracking()
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .FirstAsync(r => r.Id == id, ct);

        return mapper.Map<RoleDto>(updatedRole);
    }
}
