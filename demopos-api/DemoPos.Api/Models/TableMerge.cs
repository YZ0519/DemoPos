namespace DemoPos.Api.Models;

public class TableMerge
{
    public int Id { get; set; }
    public int PrimarySaleId { get; set; }
    public int? AbsorbedTableId { get; set; }
    public int? AbsorbedSaleId { get; set; }
    public int? MergedByUserId { get; set; }
    public DateTime MergedAt { get; set; } = DateTime.UtcNow;

    public Sale PrimarySale { get; set; } = null!;
    public RestaurantTable? AbsorbedTable { get; set; }
    public Sale? AbsorbedSale { get; set; }
}
