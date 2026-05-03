namespace DemoPos.Api.Models;

public class PurchaseItem
{
    public int Id { get; set; }
    public int PurchaseId { get; set; }
    public int ProductId { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal Price { get; set; }   // selling price at time of purchase
    public int Quantity { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Purchase Purchase { get; set; } = null!;
    public Product Product { get; set; } = null!;
}
