using Microsoft.AspNetCore.Http;

namespace DemoPos.Api.DTOs.Categories;

public class CreateCategoryRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool Status { get; set; } = true;
    public IFormFile? Image { get; set; }
}
