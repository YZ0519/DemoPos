namespace DemoPos.Api.Models;

public class StockAssemblyItem
{
    public int Id { get; set; }

    public int StockAssemblyId { get; set; }
    public StockAssembly? StockAssembly { get; set; }

    /// <summary>The ingredient product consumed in this assembly run.</summary>
    public int ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Net quantity consumed that contributes to the output.</summary>
    public decimal QuantityUsed { get; set; }

    /// <summary>Additional quantity consumed as waste/loss. Default 0. Deducted from stock but does not count toward output.</summary>
    public decimal WasteQuantity { get; set; } = 0m;

    /// <summary>Snapshot of Product.PurchasePrice at time of assembly. Not updated retroactively.</summary>
    public decimal UnitCostAtTime { get; set; }
}
