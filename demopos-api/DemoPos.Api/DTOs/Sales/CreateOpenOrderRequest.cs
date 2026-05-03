using DemoPos.Api.Constants;

namespace DemoPos.Api.DTOs.Sales;

public class CreateOpenOrderRequest
{
    /// <summary>
    /// Required for dine-in orders; null for takeaway orders.
    /// Service-layer validation enforces this rule based on OrderType.
    /// </summary>
    public int? TableId { get; set; }

    public int? CustomerId { get; set; }

    public string OrderType { get; set; } = OrderTypes.DineIn; // "dine-in" | "takeaway"
}
