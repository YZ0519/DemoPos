using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace DemoPos.Api.Controllers;

/// <summary>
/// Shared base for all authenticated controllers.
/// Centralises current-user extraction and permission checking
/// so no controller duplicates that logic.
/// </summary>
[ApiController]
[Produces("application/json")]
public abstract class AppControllerBase : ControllerBase
{
    /// <summary>
    /// Returns the authenticated user's ID from the JWT sub claim.
    /// Returns 0 if the claim is absent or unparseable (should not happen
    /// on a properly protected endpoint, but avoids a FormatException).
    /// </summary>
    protected int CurrentUserId
    {
        get
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? User.FindFirstValue("sub");

            return int.TryParse(raw, out var id) ? id : 0;
        }
    }

    /// <summary>
    /// Checks whether the authenticated user's JWT contains the named permission.
    /// Permissions are stored as a comma-separated claim value.
    /// Comparison is case-insensitive and tolerates leading/trailing whitespace
    /// around individual entries.
    /// </summary>
    protected bool HasPermission(string permission)
    {
        var raw = User.FindFirstValue("permissions") ?? string.Empty;

        // RemoveEmptyEntries guards against an empty claim producing [""].
        // OrdinalIgnoreCase makes matching robust against casing differences.
        var parts = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return Array.Exists(parts, p => p.Equals(permission, StringComparison.OrdinalIgnoreCase));
    }
}
