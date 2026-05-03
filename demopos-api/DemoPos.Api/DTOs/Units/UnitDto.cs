namespace DemoPos.Api.DTOs.Units;

public class UnitDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
