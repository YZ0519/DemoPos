namespace DemoPos.Api.DTOs.Products;

public class BulkSetPosEnabledRequest
{
    public List<int> Ids { get; set; } = [];
    public bool PosEnabled { get; set; }
}
