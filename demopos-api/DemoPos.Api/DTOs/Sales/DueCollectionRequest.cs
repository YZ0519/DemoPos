namespace DemoPos.Api.DTOs.Sales;

public class DueCollectionRequest
{
    public decimal Amount { get; set; }
    /// <summary>
    /// Gross cash tendered by the customer (may exceed Amount for cash payments).
    /// Defaults to Amount when not supplied (card / QR / bank exact-pay).
    /// Change = PaidAmount - Amount.
    /// </summary>
    public decimal PaidAmount { get; set; } = 0m;
    public int PaymentMethodId { get; set; }
    public string? TransactionId { get; set; }
}
