using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Modifier;

public class CreateModifierOptionRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Range(0, 99999.99)]
    public decimal PriceAdjustment { get; set; } = 0;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
}
