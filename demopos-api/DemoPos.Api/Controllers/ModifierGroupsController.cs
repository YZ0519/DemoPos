using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Modifier;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

/// <summary>
/// Manages product modifier groups and their options.
/// Modifier groups allow products to have configurable add-ons (e.g. "Doneness", "Extra toppings").
/// GET endpoints are auth-only (no explicit permission) so both POS and Products pages can load them.
/// Write endpoints require product_update permission.
/// </summary>
[Route("api/modifier-groups")]
[Authorize]
public class ModifierGroupsController(IModifierService modifiers) : AppControllerBase
{
    /// <summary>
    /// Returns all modifier groups (with options) for a given product.
    /// No explicit permission required — any authenticated user can read modifier definitions.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetByProduct(
        [FromQuery] int productId,
        CancellationToken ct)
    {
        if (productId <= 0)
            return BadRequest(new { success = false, message = "productId is required." });

        var result = await modifiers.GetByProductAsync(productId, ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>Creates a new modifier group for a product.</summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateGroup(
        [FromBody] CreateModifierGroupRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await modifiers.CreateGroupAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    /// <summary>Updates an existing modifier group.</summary>
    [HttpPut("{groupId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateGroup(
        int groupId,
        [FromBody] CreateModifierGroupRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await modifiers.UpdateGroupAsync(groupId, request, ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>Deletes a modifier group and all its options (cascade).</summary>
    [HttpDelete("{groupId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteGroup(int groupId, CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();

        await modifiers.DeleteGroupAsync(groupId, ct);
        return Ok(new { success = true, data = new { id = groupId } });
    }

    /// <summary>Adds an option to an existing modifier group.</summary>
    [HttpPost("{groupId:int}/options")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateOption(
        int groupId,
        [FromBody] CreateModifierOptionRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await modifiers.CreateOptionAsync(groupId, request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    /// <summary>Updates an existing modifier option.</summary>
    [HttpPut("{groupId:int}/options/{optionId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateOption(
        int groupId,
        int optionId,
        [FromBody] CreateModifierOptionRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var result = await modifiers.UpdateOptionAsync(groupId, optionId, request, ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>Deletes a modifier option.</summary>
    [HttpDelete("{groupId:int}/options/{optionId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteOption(int groupId, int optionId, CancellationToken ct)
    {
        if (!HasPermission("product_update")) return Forbid();

        await modifiers.DeleteOptionAsync(groupId, optionId, ct);
        return Ok(new { success = true, data = new { id = optionId } });
    }
}
