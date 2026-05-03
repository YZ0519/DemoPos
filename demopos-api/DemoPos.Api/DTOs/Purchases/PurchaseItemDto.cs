namespace DemoPos.Api.DTOs.Purchases;

public class PurchaseItemDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal PurchasePrice { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public decimal RowTotal { get; set; }  // PurchasePrice * Quantity — computed by AutoMapper
}
