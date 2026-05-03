using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Sales;

public class SettleOrderRequest
{
    public int? CustomerId { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Bill discount must be zero or greater.")]
    public decimal BillDiscount { get; set; } = 0;

    public string DiscountType { get; set; } = "fixed"; // "fixed" | "percentage"

    public int? PaymentMethodId { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Paid amount must be zero or greater.")]
    public decimal Paid { get; set; }

    public string? VoucherCode { get; set; }

    public string? Note { get; set; }
}
