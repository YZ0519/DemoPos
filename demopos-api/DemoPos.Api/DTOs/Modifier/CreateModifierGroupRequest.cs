using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Modifier;

public class CreateModifierGroupRequest
{
    [Required]
    public int ProductId { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public bool IsRequired { get; set; } = false;

    [Range(0, 100)]
    public int MinSelections { get; set; } = 0;

    [Range(1, 100)]
    public int MaxSelections { get; set; } = 1;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}
