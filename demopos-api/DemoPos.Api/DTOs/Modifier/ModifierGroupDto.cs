namespace DemoPos.Api.DTOs.Modifier;

public class ModifierGroupDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public int MinSelections { get; set; }
    public int MaxSelections { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public List<ModifierOptionDto> Options { get; set; } = new();
}
