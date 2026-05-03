using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Permissions;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/permissions")]
[Authorize]
public class PermissionsController(IPermissionService permissions) : AppControllerBase
{
    // ── GET /api/permissions ───────────────────────────────────────────────────

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("permission_view"))
            return Forbid();

        var result = await permissions.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    // ── POST /api/permissions ──────────────────────────────────────────────────

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreatePermissionRequest request, CancellationToken ct)
    {
        if (!HasPermission("role_create"))
            return Forbid();

        var permission = await permissions.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = permission });
    }

    // ── PUT /api/permissions/{id} ──────────────────────────────────────────────

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePermissionRequest request, CancellationToken ct)
    {
        if (!HasPermission("role_update"))
            return Forbid();

        var permission = await permissions.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = permission });
    }

    // ── DELETE /api/permissions/{id} ───────────────────────────────────────────

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("role_delete"))
            return Forbid();

        await permissions.DeleteAsync(id, ct);
        return Ok(new { success = true, message = "Permission deleted" });
    }
}
