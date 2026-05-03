namespace DemoPos.Api.DTOs.Categories;

public class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Image { get; set; }
    public bool Status { get; set; }
    public DateTime CreatedAt { get; set; }
}
