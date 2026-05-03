namespace DemoPos.Api.Models;

public class Setting
{
    public int Id { get; set; }

    /// <summary>Unique machine-readable key, e.g. "site_name".</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>String value; nullable for settings that have not been configured.</summary>
    public string? Value { get; set; }

    /// <summary>Logical group: "general" | "contacts" | "invoice".</summary>
    public string Group { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
