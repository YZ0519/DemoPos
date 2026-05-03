using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Currencies;

public class CreateOrUpdateCurrencyRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    /// <summary>ISO 4217 currency code, e.g. "USD".</summary>
    [Required]
    public string Code { get; set; } = string.Empty;

    /// <summary>Display symbol, e.g. "$".</summary>
    [Required]
    public string Symbol { get; set; } = string.Empty;
}
