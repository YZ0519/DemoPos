namespace DemoPos.Api.Models;

public class AssemblyTemplateItem
{
    public int Id { get; set; }

    public int AssemblyTemplateId { get; set; }
    public AssemblyTemplate? AssemblyTemplate { get; set; }

    /// <summary>The input / ingredient product for this template line.</summary>
    public int ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Default quantity of this ingredient consumed per assembly run.</summary>
    public decimal DefaultQuantity { get; set; }

    /// <summary>Display order within the template editor.</summary>
    public int SortOrder { get; set; } = 0;
}
