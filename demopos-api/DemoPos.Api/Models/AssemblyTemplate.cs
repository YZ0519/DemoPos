namespace DemoPos.Api.Models;

public class AssemblyTemplate
{
    public int Id { get; set; }

    /// <summary>Descriptive name, e.g. "Cola Box Split" or "Fish Rice Recipe".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>"split" or "production".</summary>
    public string AssemblyType { get; set; } = "split";

    /// <summary>The product whose stock is increased by this assembly.</summary>
    public int OutputProductId { get; set; }
    public Product? OutputProduct { get; set; }

    /// <summary>Default number of output units produced per run.</summary>
    public decimal DefaultYield { get; set; }

    public string? Description { get; set; }

    /// <summary>Inactive templates are hidden from the selection UI.</summary>
    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<AssemblyTemplateItem> Items { get; set; } = new List<AssemblyTemplateItem>();
    public ICollection<StockAssembly> Assemblies { get; set; } = new List<StockAssembly>();
}
