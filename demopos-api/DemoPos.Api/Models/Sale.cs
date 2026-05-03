using DemoPos.Api.Constants;

namespace DemoPos.Api.Models;

public class Sale
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public int CustomerId { get; set; }
    public decimal SubTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public decimal RoundingAdjustment { get; set; } = 0m;
    public decimal RoundedTotal { get; set; } = 0m;
    public decimal Paid { get; set; }
    public decimal Due { get; set; }
    public decimal Change { get; set; } = 0m;
    public string? Note { get; set; }
    public bool IsReturned { get; set; }
    public int Status { get; set; } // 0 = Due, 1 = Paid
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? OrderDate { get; set; }

    // Restaurant fields (Phase 2 — R1 Table Management)
    public int? TableId { get; set; }
    public string OrderType { get; set; } = OrderTypes.Pos;       // "pos" | "dine-in" | "takeaway"
    public string OrderStatus { get; set; } = OrderStatuses.Paid; // "open" | "paid" | "voided"
    public decimal TakeawayCharge { get; set; } = 0;

    // Restaurant fields (Phase 3 — R2/R6 Open Orders & Discount Enhancement)
    public string? DiscountType { get; set; }            // "fixed" | "percentage"
    public string? VoucherCode { get; set; }             // for future Phase 5 use

    // Navigation
    public User? User { get; set; }
    public Customer Customer { get; set; } = null!;
    public RestaurantTable? Table { get; set; }
    public ICollection<SaleItem> SaleItems { get; set; } = [];
    public ICollection<SaleTransaction> SaleTransactions { get; set; } = [];
}
