namespace DemoPos.Api.DTOs.Suppliers;

public class UpdateSupplierRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
}
