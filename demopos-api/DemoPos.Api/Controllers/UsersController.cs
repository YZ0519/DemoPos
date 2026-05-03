using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Users;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/users")]
[Authorize]
public class UsersController(IUserService users, IConfiguration config, IAuditService audit) : AppControllerBase
{
    // Resolved once per controller lifetime, not on every request.
    private readonly string _demoEmail = config["App:DemoEmail"] ?? string.Empty;

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("user_view"))
            return Forbid();

        var result = await users.GetAllAsync(ct);
        return Ok(new { success = true, data = result });
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        if (!HasPermission("user_create"))
            return Forbid();

        var user = await users.CreateAsync(request, ct);

        await audit.LogAsync(
            "CREATE", "User", user.Id.ToString(),
            $"User '{user.Email}' created",
            CurrentUserId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return StatusCode(StatusCodes.Status201Created, new { success = true, data = user });
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        if (!HasPermission("user_update"))
            return Forbid();

        var user = await users.UpdateAsync(id, request, CurrentUserId, _demoEmail, ct);
        return Ok(new { success = true, data = user });
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("user_delete"))
            return Forbid();

        await users.DeleteAsync(id, CurrentUserId, _demoEmail, ct);

        await audit.LogAsync(
            "DELETE", "User", id.ToString(),
            $"User #{id} deleted",
            CurrentUserId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return Ok(new { success = true, message = "User deleted" });
    }

    [HttpPatch("{id:int}/suspend")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Suspend(int id, [FromBody] SuspendUserRequest request, CancellationToken ct)
    {
        if (!HasPermission("user_suspend"))
            return Forbid();

        var user = await users.SuspendAsync(id, request, _demoEmail, ct);

        var suspendAction = user.IsSuspended ? "SUSPEND" : "UNSUSPEND";
        var description = user.IsSuspended
            ? $"User #{id} suspended"
            : $"User #{id} unsuspended";

        await audit.LogAsync(
            suspendAction, "User", id.ToString(),
            description,
            CurrentUserId, HttpContext.Connection.RemoteIpAddress?.ToString(), ct);

        return Ok(new { success = true, data = user });
    }
}
