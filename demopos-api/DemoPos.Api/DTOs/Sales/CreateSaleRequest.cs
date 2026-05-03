using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Sales;

public class CreateSaleRequest
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "A valid customer is required.")]
    public int CustomerId { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Discount must be zero or greater.")]
    public decimal Discount { get; set; } = 0m;   // order-level discount amount (monetary)

    /// <summary>
    /// "fixed" (default) or "percentage". When "percentage", Discount is treated as
    /// a percentage value (0-100) and converted to a monetary amount server-side.
    /// </summary>
    public string? DiscountType { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Paid amount must be zero or greater.")]
    public decimal Paid { get; set; } = 0m;

    public int? PaymentMethodId { get; set; }
    public string? Note { get; set; }
    public DateTime? OrderDate { get; set; }
    public string? VoucherCode { get; set; }
}
