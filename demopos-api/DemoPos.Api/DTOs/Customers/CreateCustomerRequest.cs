namespace DemoPos.Api.DTOs.Customers;

public class CreateCustomerRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
}
