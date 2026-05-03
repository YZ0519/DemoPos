using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Roles;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/roles")]
[Authorize]
public class RolesController(IRoleService roles) : AppControllerBase
{
    // ── GET /api/roles ─────────────────────────────────────────────────────────

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("role_view"))
            return Forbid();

        var result = await roles.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // ── POST /api/roles ────────────────────────────────────────────────────────

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateRoleRequest request, CancellationToken ct)
    {
        if (!HasPermission("role_create"))
            return Forbid();

        var role = await roles.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = role });
    }

    // ── PUT /api/roles/{id} ────────────────────────────────────────────────────

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleRequest request, CancellationToken ct)
    {
        if (!HasPermission("role_update"))
            return Forbid();

        var role = await roles.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = role });
    }

    // ── DELETE /api/roles/{id} ─────────────────────────────────────────────────

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("role_delete"))
            return Forbid();

        await roles.DeleteAsync(id, ct);
        return Ok(new { success = true, message = "Role deleted" });
    }

    // ── GET /api/roles/{id}/permissions ───────────────────────────────────────
    // Any authenticated user may read a role's permission list — no specific
    // permission required (used by the UI permission assignment screen).

    [HttpGet("{id:int}/permissions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPermissions(int id, CancellationToken ct)
    {
        var permissions = await roles.GetPermissionsAsync(id, ct);
        return Ok(new { success = true, data = permissions });
    }

    // ── POST /api/roles/{id}/permissions ──────────────────────────────────────
    // Sync (replace) permissions for a role.  Requires role_update permission.

    [HttpPost("{id:int}/permissions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SyncPermissions(int id, [FromBody] SyncPermissionsRequest request, CancellationToken ct)
    {
        if (!HasPermission("role_update"))
            return Forbid();

        var role = await roles.SyncPermissionsAsync(id, request, ct);
        return Ok(new { success = true, data = role });
    }
}
