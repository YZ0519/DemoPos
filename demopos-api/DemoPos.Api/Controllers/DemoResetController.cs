using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Data;

namespace DemoPos.Api.Controllers;

/// <summary>
/// Provides a protected endpoint to wipe and re-seed all demo data.
/// Intended for the public demo site — lets the admin restore a clean
/// state when visitors have corrupted the database.
/// </summary>
[Route("api/demo")]
[Authorize]
public class DemoResetController(AppDbContext db) : AppControllerBase
{
    /// <summary>
    /// Deletes all transactional and showcase data, then re-runs the full
    /// seed pipeline (SeedData + ShowcaseSeeder) to restore a clean 6-month
    /// dataset.
    ///
    /// Requires the caller to be authenticated and have the
    /// "website_settings" permission (admin-only).
    ///
    /// The admin user and core role/permission rows are preserved.
    /// </summary>
    [HttpPost("reset")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reset(CancellationToken ct)
    {
        if (!HasPermission("website_settings"))
            return Forbid();

        // ── Delete in FK-safe order ────────────────────────────────────────
        // Leaf tables first, then parent tables.

        // Sales
        await db.SaleTransactions.ExecuteDeleteAsync(ct);
        await db.SaleItems.ExecuteDeleteAsync(ct);
        await db.Sales.ExecuteDeleteAsync(ct);

        // Purchases
        await db.PurchaseTransactions.ExecuteDeleteAsync(ct);
        await db.PurchaseItems.ExecuteDeleteAsync(ct);
        await db.Purchases.ExecuteDeleteAsync(ct);

        // Stock assembly
        await db.StockAssemblyItems.ExecuteDeleteAsync(ct);
        await db.StockAssemblies.ExecuteDeleteAsync(ct);
        await db.AssemblyTemplateItems.ExecuteDeleteAsync(ct);
        await db.AssemblyTemplates.ExecuteDeleteAsync(ct);

        // Product bundles / combos / modifiers / vouchers / POS cart
        await db.BundleStepProducts.ExecuteDeleteAsync(ct);
        await db.BundleSteps.ExecuteDeleteAsync(ct);
        await db.ProductBundles.ExecuteDeleteAsync(ct);
        await db.ComboItems.ExecuteDeleteAsync(ct);
        await db.ProductModifierOptions.ExecuteDeleteAsync(ct);
        await db.ProductModifierGroups.ExecuteDeleteAsync(ct);
        await db.VoucherPackageItems.ExecuteDeleteAsync(ct);
        await db.VoucherPackages.ExecuteDeleteAsync(ct);
        await db.PosCarts.ExecuteDeleteAsync(ct);

        // Products (all FK children cleared above)
        await db.Products.ExecuteDeleteAsync(ct);

        // Customers
        await db.Customers.ExecuteDeleteAsync(ct);

        // Tables
        await db.TableMerges.ExecuteDeleteAsync(ct);
        await db.RestaurantTables.ExecuteDeleteAsync(ct);

        // Auth tokens for demo users (keep admin's tokens)
        await db.RefreshTokens.Where(t => t.User!.Username != "admin").ExecuteDeleteAsync(ct);
        await db.ForgetPasswords.Where(f => f.User!.Username != "admin").ExecuteDeleteAsync(ct);

        // Demo users (keep admin)
        await db.Users.Where(u => u.Username != "admin").ExecuteDeleteAsync(ct);

        // Catalog lookup tables
        await db.Brands.ExecuteDeleteAsync(ct);
        await db.Categories.ExecuteDeleteAsync(ct);
        await db.Units.ExecuteDeleteAsync(ct);
        await db.Suppliers.ExecuteDeleteAsync(ct);
        await db.PaymentMethods.ExecuteDeleteAsync(ct);

        // ── Re-seed everything ─────────────────────────────────────────────
        // SeedData recreates catalog + calls ShowcaseSeeder for 6-month data.
        await SeedData.SeedAsync(db);

        return Ok(new { success = true, message = "Demo data has been reset successfully." });
    }
}
