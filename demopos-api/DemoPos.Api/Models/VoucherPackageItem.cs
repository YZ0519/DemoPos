namespace DemoPos.Api.Models;

public class VoucherPackageItem
{
    public int Id { get; set; }
    public int VoucherPackageId { get; set; }
    public int ProductId { get; set; }
    public decimal? OverridePrice { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public VoucherPackage VoucherPackage { get; set; } = null!;
    public Product Product { get; set; } = null!;
}
