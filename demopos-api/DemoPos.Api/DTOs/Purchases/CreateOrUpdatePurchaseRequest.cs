using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Purchases;

public class CreateOrUpdatePurchaseRequest
{
    public int? PurchaseId { get; set; }       // null = create, int = edit

    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "A valid supplier is required.")]
    public int SupplierId { get; set; }

    public DateTime? Date { get; set; }
    public int? PaymentMethodId { get; set; }
    public string? Note { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one product line is required.")]
    public List<PurchaseProductRequest> Products { get; set; } = [];

    public PurchaseTotalsRequest Totals { get; set; } = null!;
}

public class PurchaseProductRequest
{
    public int Id { get; set; }          // Product.Id
    public int? ItemId { get; set; }     // PurchaseItem.Id for edit mode (0 or null = new item)
    public decimal PurchasePrice { get; set; }
    public decimal Price { get; set; }
    public int Qty { get; set; }
}

public class PurchaseTotalsRequest
{
    public decimal SubTotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public string DiscountType { get; set; } = "fixed";
    public decimal Shipping { get; set; }
    public decimal GrandTotal { get; set; }
}
