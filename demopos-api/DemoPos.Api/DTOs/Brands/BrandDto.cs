namespace DemoPos.Api.DTOs.Brands;

public class BrandDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Image { get; set; }
    public bool Status { get; set; }
    public DateTime CreatedAt { get; set; }
}
