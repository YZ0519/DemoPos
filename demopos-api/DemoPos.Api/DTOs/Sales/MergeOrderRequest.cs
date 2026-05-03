using System.ComponentModel.DataAnnotations;

namespace DemoPos.Api.DTOs.Sales;

public class MergeOrderRequest
{
    [MinLength(1, ErrorMessage = "At least one sale to absorb must be provided.")]
    public List<int> AbsorbSaleIds { get; set; } = new();
}
