namespace DemoPos.Api.DTOs.Purchases;

// Inherits Id, SupplierId, SupplierName, GrandTotal, Date, CreatedAt from PurchaseSummaryDto.
// AutoMapper's IncludeBase<Purchase, PurchaseSummaryDto>() in MappingProfile requires this
// C# inheritance relationship to be present on the destination type.
public class PurchaseDetailDto : PurchaseSummaryDto
{
    public decimal SubTotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public string DiscountType { get; set; } = "fixed";
    public decimal Shipping { get; set; }
    public List<PurchaseItemDto> Items { get; set; } = [];
}
