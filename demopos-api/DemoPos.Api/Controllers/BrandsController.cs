using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Brands;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/brands")]
[Authorize]
public class BrandsController(IBrandService brands) : AppControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("brand_view")) return Forbid();

        var result = await brands.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromForm] CreateBrandRequest request, CancellationToken ct)
    {
        if (!HasPermission("brand_create")) return Forbid();

        var result = await brands.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateBrandRequest request, CancellationToken ct)
    {
        if (!HasPermission("brand_update")) return Forbid();

        var result = await brands.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("brand_delete")) return Forbid();

        await brands.DeleteAsync(id, ct);
        return Ok(new { success = true, message = "Brand deleted" });
    }
}
