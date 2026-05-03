namespace DemoPos.Api.DTOs.Sales;

public class KitchenTicketResponse
{
    public int SaleId { get; set; }
    public string? TableNumber { get; set; }
    public string? TableLabel { get; set; }
    public string? OrderType { get; set; }  // "dine-in" | "takeaway" | "pos"
    public DateTime SentAt { get; set; }
    public List<KitchenTicketItem> TicketItems { get; set; } = new();
}

public class KitchenTicketItem
{
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public string? ModifierNote { get; set; }
    public bool IsVoid { get; set; } = false;
}
