using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.RestaurantTable;

public class UpdateTableRequest
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "Number must be at least 1.")]
    public int Number { get; set; }

    public string? Label { get; set; }

    [Range(1, 100, ErrorMessage = "Capacity must be between 1 and 100.")]
    public int Capacity { get; set; } = 4;

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;
}
