using DemoPos.Api.Constants;

namespace DemoPos.Api.DTOs.Sales;

public class SaleSummaryDto
{
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public decimal SubTotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public decimal RoundingAdjustment { get; set; }
    public decimal RoundedTotal { get; set; }
    public decimal Paid { get; set; }
    public decimal Due { get; set; }
    public decimal Change { get; set; }
    public int Status { get; set; }
    public string StatusLabel { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? OrderDate { get; set; }

    // Restaurant fields
    public string OrderType { get; set; } = OrderTypes.Pos;
    public string OrderStatus { get; set; } = OrderStatuses.Paid;
    public int? TableId { get; set; }
    public string? TableNumber { get; set; }
    public string? TableLabel { get; set; }
    public decimal TakeawayCharge { get; set; }
    public string? DiscountType { get; set; }
    public string? VoucherCode { get; set; }
}
