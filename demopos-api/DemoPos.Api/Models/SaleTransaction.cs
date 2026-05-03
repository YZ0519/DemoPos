namespace DemoPos.Api.Models;

public class SaleTransaction
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public int CustomerId { get; set; }
    public int? UserId { get; set; }
    public decimal Amount { get; set; }
    public decimal Change { get; set; } = 0m;
    public string PaidBy { get; set; } = "cash"; // cash | card | bank
    public string? TransactionId { get; set; }
    public int? PaymentMethodId { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Sale Sale { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public User? User { get; set; }
}
