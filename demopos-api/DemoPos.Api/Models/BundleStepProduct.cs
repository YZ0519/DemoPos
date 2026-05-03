namespace DemoPos.Api.Models;

public class BundleStepProduct
{
    public int Id { get; set; }
    public int BundleStepId { get; set; }
    public int ProductId { get; set; }
    public int SortOrder { get; set; }

    // Navigation
    public BundleStep BundleStep { get; set; } = null!;
    public Product Product { get; set; } = null!;
}
