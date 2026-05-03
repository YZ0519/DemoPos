using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.Users;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/profile")]
[Authorize]
public class ProfileController(IUserService users, IConfiguration config) : AppControllerBase
{
    // Resolved once per controller lifetime, not on every request.
    private readonly string _demoEmail = config["App:DemoEmail"] ?? string.Empty;

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile(CancellationToken ct)
    {
        var profile = await users.GetProfileAsync(CurrentUserId, ct);
        return Ok(new { success = true, data = profile });
    }

    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        var profile = await users.UpdateProfileAsync(CurrentUserId, request, _demoEmail, ct);
        return Ok(new { success = true, data = profile });
    }
}
