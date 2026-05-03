namespace DemoPos.Api.DTOs.Sales;

public class SaleTransactionDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public decimal Change { get; set; }
    public string PaidBy { get; set; } = string.Empty;
    public string? TransactionId { get; set; }
    public string? UserName { get; set; }
    public int? PaymentMethodId { get; set; }
    public string? PaymentMethodName { get; set; }
    public DateTime CreatedAt { get; set; }
}
