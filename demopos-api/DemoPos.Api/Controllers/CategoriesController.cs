using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Categories;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/categories")]
[Authorize]
public class CategoriesController(ICategoryService categories) : AppControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("category_view")) return Forbid();

        var result = await categories.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromForm] CreateCategoryRequest request, CancellationToken ct)
    {
        if (!HasPermission("category_create")) return Forbid();

        var result = await categories.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateCategoryRequest request, CancellationToken ct)
    {
        if (!HasPermission("category_update")) return Forbid();

        var result = await categories.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("category_delete")) return Forbid();

        await categories.DeleteAsync(id, ct);
        return Ok(new { success = true, message = "Category deleted" });
    }
}
