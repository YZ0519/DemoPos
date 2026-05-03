namespace DemoPos.Api.Models;

public class Unit
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Product> Products { get; set; } = new List<Product>();
}
