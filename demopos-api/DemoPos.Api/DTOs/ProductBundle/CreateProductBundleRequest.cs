using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.ProductBundle;

public class CreateProductBundleRequest
{
    [Required]
    [MinLength(1)]
    public string Name { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0.")]
    public decimal Price { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "MinItems must be at least 0.")]
    public int MinItems { get; set; } = 1;

    [Range(1, int.MaxValue, ErrorMessage = "MaxItems must be at least 1.")]
    public int MaxItems { get; set; } = 1;

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Optional multi-step selection configuration.
    /// When provided, MinItems/MaxItems are computed from step constraints.
    /// </summary>
    public List<BundleStepInput>? Steps { get; set; }
}
