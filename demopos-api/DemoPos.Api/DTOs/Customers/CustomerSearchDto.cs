namespace DemoPos.Api.DTOs.Customers;

/// <summary>
/// Lightweight projection for the POS customer autocomplete dropdown.
/// Only includes the fields the frontend needs — avoids over-fetching.
/// </summary>
public class CustomerSearchDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
}
