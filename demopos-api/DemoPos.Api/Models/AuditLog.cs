namespace DemoPos.Api.Models;

public class AuditLog
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>
    /// High-level action: "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "RETURN", "SUSPEND"
    /// </summary>
    public string Action { get; set; } = "";

    /// <summary>
    /// The domain entity affected: "Sale", "Purchase", "Product", "User", "Role", etc.
    /// </summary>
    public string EntityType { get; set; } = "";

    /// <summary>
    /// Primary key of the affected entity as a string (accommodates any PK type).
    /// </summary>
    public string? EntityId { get; set; }

    /// <summary>
    /// Human-readable summary, e.g. "Sale #42 deleted by Admin".
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Remote IP address of the caller at the time of the action.
    /// </summary>
    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; }
}
