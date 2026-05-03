namespace DemoPos.Api.DTOs.Products;

public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int? BrandId { get; set; }
    public string? BrandName { get; set; }
    public int? UnitId { get; set; }
    public string? UnitShortName { get; set; }
    public decimal Price { get; set; }
    public decimal? Discount { get; set; }
    public string? DiscountType { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal DiscountedPrice { get; set; }
    public int Quantity { get; set; }
    public DateOnly? ExpireDate { get; set; }
    public bool Status { get; set; }
    public bool PosEnabled { get; set; }
    public string? Image { get; set; }
    public int? AutoAssemblyTemplateId { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>True when the product has at least one active modifier group.</summary>
    public bool HasModifiers { get; set; }
}
