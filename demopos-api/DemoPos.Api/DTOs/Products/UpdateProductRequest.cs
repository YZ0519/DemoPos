using Microsoft.AspNetCore.Http;

namespace DemoPos.Api.DTOs.Products;

public class UpdateProductRequest
{
    public string Name { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? CategoryId { get; set; }
    public int? BrandId { get; set; }
    public int? UnitId { get; set; }
    public decimal Price { get; set; } = 0m;
    public decimal? Discount { get; set; }
    public string? DiscountType { get; set; }
    public decimal PurchasePrice { get; set; } = 0m;
    public int Quantity { get; set; } = 0;
    public DateOnly? ExpireDate { get; set; }
    public bool Status { get; set; } = true;
    public bool PosEnabled { get; set; } = false;
    public IFormFile? Image { get; set; }
    public int? AutoAssemblyTemplateId { get; set; }
}
