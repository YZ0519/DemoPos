using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.ProductBundle;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/product-bundles")]
[Authorize]
public class ProductBundlesController(IProductBundleService bundleService) : AppControllerBase
{
    /// <summary>
    /// POS terminal endpoint — returns only active bundles.
    /// No permission gate: any authenticated user can reach this so that cashiers
    /// without product_bundle_view can still see bundles in the POS grid.
    /// Declared before [HttpGet] (no-segment route) so it doesn't shadow it.
    /// </summary>
    // GET /api/product-bundles/pos
    [HttpGet("pos")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPosActiveBundles(CancellationToken ct)
    {
        var result = await bundleService.GetAllAsync(activeOnly: true, ct);
        return Ok(new { success = true, data = result });
    }

    // GET /api/product-bundles?activeOnly=true
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool? activeOnly,
        CancellationToken ct)
    {
        if (!HasPermission("product_bundle_view")) return Forbid();

        var result = await bundleService.GetAllAsync(activeOnly, ct);
        return Ok(new { success = true, data = result });
    }

    // POST /api/product-bundles
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateProductBundleRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_bundle_create")) return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        var result = await bundleService.CreateAsync(request, ct);
        return StatusCode(201, new { success = true, data = result });
    }

    // PUT /api/product-bundles/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateProductBundleRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("product_bundle_update")) return Forbid();

        if (!ModelState.IsValid)
            return BadRequest(new { success = false, errors = ModelState });

        var result = await bundleService.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    // DELETE /api/product-bundles/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("product_bundle_delete")) return Forbid();

        try
        {
            await bundleService.DeleteAsync(id, ct);
            return Ok(new { success = true, data = new { id } });
        }
        catch (InvalidOperationException ex)
        {
            // Bundle is in use — return 409 Conflict to distinguish from a generic error
            return StatusCode(409, new { success = false, message = ex.Message });
        }
    }
}
