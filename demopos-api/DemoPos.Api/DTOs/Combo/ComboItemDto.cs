namespace DemoPos.Api.DTOs.Combo;

public class ComboItemDto
{
    public int Id { get; set; }
    public int ComboProductId { get; set; }
    public int ComponentProductId { get; set; }
    public string ComponentProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public int SortOrder { get; set; }
}
