using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Combo;

public class CreateComboItemRequest
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "ComponentProductId must be a valid product ID.")]
    public int ComponentProductId { get; set; }

    [Range(0.001, 9999, ErrorMessage = "Quantity must be between 0.001 and 9999.")]
    public decimal Quantity { get; set; } = 1;

    public int SortOrder { get; set; } = 0;
}
