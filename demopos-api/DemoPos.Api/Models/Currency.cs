namespace DemoPos.Api.Models;

public class Currency
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>ISO 4217 currency code, e.g. "USD", "BDT".</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Display symbol, e.g. "$", "৳".</summary>
    public string Symbol { get; set; } = string.Empty;

    /// <summary>True for the single active/default currency used across the POS.</summary>
    public bool Active { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
