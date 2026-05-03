namespace DemoPos.Api.DTOs.Purchases;

public class PurchaseSummaryDto
{
    public int Id { get; set; }
    public int SupplierId { get; set; }
    public string SupplierName { get; set; } = string.Empty;
    public decimal GrandTotal { get; set; }
    public decimal RoundingAdjustment { get; set; }
    public decimal RoundedTotal { get; set; }
    public string? PaymentMethodName { get; set; }
    public DateTime Date { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? Note { get; set; }
}
