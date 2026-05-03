namespace DemoPos.Api.DTOs.Suppliers;

public class CreateSupplierRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
}
