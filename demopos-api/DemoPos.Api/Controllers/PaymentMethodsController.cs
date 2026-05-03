using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using DemoPos.Api.DTOs.PaymentMethods;
using DemoPos.Api.Services.Abstraction;

namespace DemoPos.Api.Controllers;

[Route("api/payment-methods")]
[Authorize]
public class PaymentMethodsController(IPaymentMethodService paymentMethods) : AppControllerBase
{
    /// <summary>
    /// Returns all payment methods (active and inactive).
    /// Requires <c>payment_method_view</c> permission.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        if (!HasPermission("payment_method_view")) return Forbid();

        var result = await paymentMethods.GetAllAsync(activeOnly: false, ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Returns only active payment methods.
    /// Used by POS checkout and purchase forms to populate dropdowns.
    /// Requires authentication only (no specific permission).
    /// </summary>
    [HttpGet("active")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActive(CancellationToken ct)
    {
        var result = await paymentMethods.GetAllAsync(activeOnly: true, ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Creates a new payment method.
    /// Requires <c>payment_method_create</c> permission.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreatePaymentMethodRequest request, CancellationToken ct)
    {
        if (!HasPermission("payment_method_create")) return Forbid();

        var result = await paymentMethods.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    /// <summary>
    /// Updates an existing payment method.
    /// Requires <c>payment_method_update</c> permission.
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePaymentMethodRequest request, CancellationToken ct)
    {
        if (!HasPermission("payment_method_update")) return Forbid();

        var result = await paymentMethods.UpdateAsync(id, request, ct);
        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Deletes a payment method.
    /// Fails if the method is the default, or is referenced by orders or purchases.
    /// Requires <c>payment_method_delete</c> permission.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!HasPermission("payment_method_delete")) return Forbid();

        await paymentMethods.DeleteAsync(id, ct);
        return Ok(new { success = true, data = new { id } });
    }
}
