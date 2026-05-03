using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Purchases;

public class PurchasePaymentRequest
{
    [Required]
    [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than zero.")]
    public decimal Amount { get; set; }

    public int? PaymentMethodId { get; set; }

    public string? Note { get; set; }
}
