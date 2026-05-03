namespace DemoPos.Api.DTOs.RestaurantTable;

public class RestaurantTableDto
{
    public int Id { get; set; }
    public int Number { get; set; }
    public string? Label { get; set; }
    public int Capacity { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
}
