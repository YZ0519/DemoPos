namespace DemoPos.Api.DTOs.Sales;

public class UpdateSaleRequest
{
    public int CustomerId { get; set; }
    public decimal Discount { get; set; } = 0m;
    public string? Note { get; set; }
    public DateTime? OrderDate { get; set; }
    public List<UpdateSaleItemRequest> Items { get; set; } = [];
}

public class UpdateSaleItemRequest
{
    /// <summary>
    /// The existing SaleItem.Id to update. Null means this is a new item to add.
    /// </summary>
    public int? Id { get; set; }

    public int ProductId { get; set; }
    public int Quantity { get; set; }
}
