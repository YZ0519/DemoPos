namespace DemoPos.Api.DTOs.Assembly;

// ── Assembly item within detail ────────────────────────────────────────────────

public class StockAssemblyItemDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string? ProductName { get; set; }
    public decimal QuantityUsed { get; set; }
    public decimal WasteQuantity { get; set; }
    /// <summary>QuantityUsed + WasteQuantity — total stock deducted.</summary>
    public decimal TotalDeducted { get; set; }
    public decimal UnitCostAtTime { get; set; }
    /// <summary>TotalDeducted * UnitCostAtTime.</summary>
    public decimal LineCost { get; set; }
}

// ── Summary (list view) ────────────────────────────────────────────────────────

public class StockAssemblySummaryDto
{
    public int Id { get; set; }
    public string AssemblyType { get; set; } = string.Empty;
    public int OutputProductId { get; set; }
    public string? OutputProductName { get; set; }
    public decimal OutputQuantity { get; set; }
    public decimal OutputCostPerUnit { get; set; }
    public string TriggeredBy { get; set; } = string.Empty;
    public int? PurchaseId { get; set; }
    public string? UserName { get; set; }
    public DateTime AssembledAt { get; set; }
    public string? Note { get; set; }
}

// ── Detail (single item view) ─────────────────────────────────────────────────

public class StockAssemblyDetailDto : StockAssemblySummaryDto
{
    public int? AssemblyTemplateId { get; set; }
    public string? TemplateName { get; set; }
    public List<StockAssemblyItemDto> Items { get; set; } = new();
}

// ── Create request ─────────────────────────────────────────────────────────────

public class CreateStockAssemblyRequest
{
    /// <summary>Optional: reference to an assembly template. If provided, pre-fills defaults.</summary>
    public int? AssemblyTemplateId { get; set; }
    /// <summary>"split" or "production"</summary>
    public string AssemblyType { get; set; } = "split";
    public int OutputProductId { get; set; }
    public decimal OutputQuantity { get; set; }
    public string? Note { get; set; }
    public List<StockAssemblyItemRequest> Items { get; set; } = new();
}

public class StockAssemblyItemRequest
{
    public int ProductId { get; set; }
    public decimal QuantityUsed { get; set; }
    public decimal WasteQuantity { get; set; } = 0m;
}

// ── Create response (includes warnings for insufficient stock) ─────────────────

public class CreateStockAssemblyResponse
{
    public StockAssemblyDetailDto Assembly { get; set; } = null!;
    public List<string> Warnings { get; set; } = new();
}
