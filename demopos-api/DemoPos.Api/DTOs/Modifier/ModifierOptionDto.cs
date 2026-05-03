namespace DemoPos.Api.DTOs.Modifier;

public class ModifierOptionDto
{
    public int Id { get; set; }
    public int ModifierGroupId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal PriceAdjustment { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}
