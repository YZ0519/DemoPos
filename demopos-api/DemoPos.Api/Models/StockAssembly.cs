namespace DemoPos.Api.Models;

public class StockAssembly
{
    public int Id { get; set; }

    /// <summary>Optional reference to the template used. Null for ad-hoc assemblies.</summary>
    public int? AssemblyTemplateId { get; set; }
    public AssemblyTemplate? AssemblyTemplate { get; set; }

    /// <summary>"split" or "production" — copied at execution time for audit purposes.</summary>
    public string AssemblyType { get; set; } = "split";

    /// <summary>The product whose stock was increased by this assembly run.</summary>
    public int OutputProductId { get; set; }
    public Product? OutputProduct { get; set; }

    /// <summary>Actual number of output units produced in this run.</summary>
    public decimal OutputQuantity { get; set; }

    /// <summary>Computed cost per output unit. Stored at execution time for audit.</summary>
    public decimal OutputCostPerUnit { get; set; }

    public string? Note { get; set; }

    /// <summary>"manual" or "purchase".</summary>
    public string TriggeredBy { get; set; } = "manual";

    /// <summary>Populated when triggered by a purchase save.</summary>
    public int? PurchaseId { get; set; }
    public Purchase? Purchase { get; set; }

    /// <summary>User who triggered / created this assembly.</summary>
    public int? UserId { get; set; }
    public User? User { get; set; }

    public DateTime AssembledAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<StockAssemblyItem> Items { get; set; } = new List<StockAssemblyItem>();
}
