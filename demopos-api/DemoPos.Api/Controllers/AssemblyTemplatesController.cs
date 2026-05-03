using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Assembly;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/assembly-templates")]
[Authorize]
public class AssemblyTemplatesController(IAssemblyService assembly) : AppControllerBase
{
    // GET /api/assembly-templates?page=1&pageSize=20
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        if (!HasPermission("assembly_view")) return Forbid();

        var (items, totalCount) = await assembly.GetTemplatesAsync(page, pageSize, ct);

        return Ok(new { success = true, data = new { items, totalCount, page, pageSize } });
    }

    // GET /api/assembly-templates/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        if (!HasPermission("assembly_view")) return Forbid();

        var result = await assembly.GetTemplateByIdAsync(id, ct);
        if (result is null) return NotFound(new { success = false, message = "Assembly template not found." });

        return Ok(new { success = true, data = result });
    }

    // POST /api/assembly-templates
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateAssemblyTemplateRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("assembly_create")) return Forbid();

        var result = await assembly.CreateTemplateAsync(request, ct);
        return StatusCode(201, new { success = true, data = result });
    }

    // PUT /api/assembly-templates/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdateAssemblyTemplateRequest request,
        CancellationToken ct)
    {
        if (!HasPermission("assembly_update")) return Forbid();

        try
        {
            var result = await assembly.UpdateTemplateAsync(id, request, ct);
            return Ok(new { success = true, data = result });
        }
        catch (KeyNotFoundException e)
        {
            return NotFound(new { success = false, message = e.Message });
        }
    }

    // DELETE /api/assembly-templates/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("assembly_delete")) return Forbid();

        try
        {
            await assembly.DeleteTemplateAsync(id, ct);
            return Ok(new { success = true, data = new { id } });
        }
        catch (KeyNotFoundException e)
        {
            return NotFound(new { success = false, message = e.Message });
        }
    }
}
