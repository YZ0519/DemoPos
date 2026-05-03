using DemoPos.Api.Constants;

namespace DemoPos.Api.Models;

public class RestaurantTable
{
    public int Id { get; set; }
    public int Number { get; set; }           // Display number e.g. 1, 2, 3
    public string? Label { get; set; }        // Optional label e.g. "Window Seat"
    public int Capacity { get; set; } = 4;
    public string Status { get; set; } = TableStatuses.Available; // "available" | "occupied"
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}
