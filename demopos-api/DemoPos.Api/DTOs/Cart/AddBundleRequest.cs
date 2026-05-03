using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Cart;

public class AddBundleRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "BundleId must be a valid bundle identifier.")]
    public int BundleId { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one product must be selected for the bundle.")]
    public List<BundleProductSelection> SelectedProducts { get; set; } = [];
}

public class BundleProductSelection
{
    [Range(1, int.MaxValue, ErrorMessage = "ProductId must be a valid product identifier.")]
    public int ProductId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
    public int Quantity { get; set; } = 1;

    /// <summary>
    /// For multi-step bundles: the step this product selection belongs to.
    /// Null for flat (non-step) bundles.
    /// </summary>
    public int? BundleStepId { get; set; }
}
