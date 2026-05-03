namespace DemoPos.Api.Models;

public class PurchaseTransaction
{
    public int Id { get; set; }
    public int PurchaseId { get; set; }
    public Purchase Purchase { get; set; } = null!;
    public int SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public int? UserId { get; set; }
    public User? User { get; set; }
    public decimal Amount { get; set; }
    public string PaidBy { get; set; } = "";
    public int? PaymentMethodId { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
