namespace DemoPos.Api.Models;

public class Purchase
{
    public int Id { get; set; }
    public int SupplierId { get; set; }
    public int? UserId { get; set; }
    public decimal SubTotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public string DiscountType { get; set; } = "fixed"; // "fixed" or "percent"
    public decimal Shipping { get; set; }
    public decimal GrandTotal { get; set; }
    public decimal RoundingAdjustment { get; set; } = 0m;
    public decimal RoundedTotal { get; set; } = 0m;
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public int Status { get; set; } = 1; // always 1 (Received)
    public int? PaymentMethodId { get; set; }
    public PaymentMethod? PaymentMethod { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }

    // Payment tracking — AmountPaid is updated as payments are recorded;
    // AmountDue = GrandTotal - AmountPaid (denormalized for fast querying).
    public decimal AmountPaid { get; set; } = 0m;
    public decimal AmountDue { get; set; } = 0m;

    // Navigation
    public Supplier Supplier { get; set; } = null!;
    public User? User { get; set; }
    public ICollection<PurchaseItem> PurchaseItems { get; set; } = [];
    public ICollection<PurchaseTransaction> PurchaseTransactions { get; set; } = [];
}
