using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.ProductBundle;

public class BundleStepInput
{
    [Required]
    [MinLength(1)]
    public string Label { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    [Range(0, int.MaxValue)]
    public int MinQuantity { get; set; } = 1;

    [Range(1, int.MaxValue)]
    public int MaxQuantity { get; set; } = 1;

    public bool IsOptional { get; set; } = false;

    [Required]
    [MinLength(1, ErrorMessage = "Each step must have at least one product.")]
    public List<int> ProductIds { get; set; } = [];
}
