using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Voucher;

public class CreateVoucherRequest
{
    [Required, MinLength(1)]
    public string Code { get; set; } = string.Empty;

    [Required, MinLength(1)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    // "fixed" | "percentage" | "override"
    // [Required] ensures an explicit null from JSON is rejected before the service layer runs.
    [Required]
    public string DiscountType { get; set; } = "fixed";

    [Range(0, double.MaxValue)]
    public decimal DiscountValue { get; set; }

    // "all" | "specific_items"
    // [Required] ensures an explicit null from JSON is rejected before the service layer runs.
    [Required]
    public string AppliesTo { get; set; } = "all";

    public bool IsActive { get; set; } = true;

    public DateTime? ValidFrom { get; set; }

    public DateTime? ValidUntil { get; set; }

    // Nullable so that an explicit JSON null does not NRE in the service.
    // The service coalesces to an empty list.
    public List<VoucherItemRequest>? Items { get; set; }
}

public class VoucherItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    public decimal? OverridePrice { get; set; }
}
