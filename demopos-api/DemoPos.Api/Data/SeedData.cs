using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Models;

namespace DemoPos.Api.Data;

public static class SeedData
{
    private static readonly string[] AllPermissions =
    [
        "dashboard_view",
        "customer_create", "customer_view", "customer_update", "customer_delete", "customer_sales",
        "supplier_view", "supplier_create", "supplier_update", "supplier_delete",
        "product_create", "product_view", "product_update", "product_delete", "product_import",
        "brand_create", "brand_view", "brand_update", "brand_delete",
        "category_create", "category_view", "category_update", "category_delete",
        "unit_create", "unit_view", "unit_update", "unit_delete",
        "sale_create", "sale_view", "sale_update", "sale_delete",
        "purchase_create", "purchase_view", "purchase_update", "purchase_delete",
        "payment_method_view", "payment_method_create", "payment_method_update", "payment_method_delete",
        "reports_summary", "reports_sales", "reports_inventory", "reports_purchases",
        "currency_create", "currency_view", "currency_update", "currency_delete", "currency_set_default",
        "role_create", "role_view", "role_update", "role_delete",
        "permission_view",
        "user_create", "user_view", "user_update", "user_delete", "user_suspend",
        "website_settings", "contact_settings", "invoice_settings",
        "assembly_view", "assembly_create", "assembly_update", "assembly_delete",
        "product_bundle_view", "product_bundle_create", "product_bundle_update", "product_bundle_delete",
        "table_view", "table_create", "table_update", "table_delete",
        "modifier_view",
        "voucher_view", "voucher_create", "voucher_update", "voucher_delete",
    ];

    public static async Task SeedAsync(AppDbContext db)
    {
        // ── Roles ────────────────────────────────────────────────────────────────
        var adminRole = await db.Roles.FirstOrDefaultAsync(r => r.Id == 1);
        if (adminRole == null)
        {
            adminRole = new Role { Name = "Admin" };
            db.Roles.Add(adminRole);
            await db.SaveChangesAsync();
        }

        if (!await db.Roles.AnyAsync(r => r.Name == "User"))
        {
            db.Roles.Add(new Role { Name = "User" });
            await db.SaveChangesAsync();
        }

        // ── Permissions — load existing names in ONE query, insert only missing ─
        var existingPermissionNames = await db.Permissions
            .AsNoTracking()
            .Select(p => p.Name)
            .ToHashSetAsync();

        var newPermissions = AllPermissions
            .Where(name => !existingPermissionNames.Contains(name))
            .Select(name => new Permission { Name = name })
            .ToList();

        if (newPermissions.Count > 0)
        {
            db.Permissions.AddRange(newPermissions);
            await db.SaveChangesAsync();
        }

        // ── Assign all permissions to Admin role ──────────────────────────────
        var allPerms = await db.Permissions.AsNoTracking().ToListAsync();

        var existingAdminPermIds = await db.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.RoleId == adminRole.Id)
            .Select(rp => rp.PermissionId)
            .ToHashSetAsync();

        var newRolePerms = allPerms
            .Where(p => !existingAdminPermIds.Contains(p.Id))
            .Select(p => new RolePermission { RoleId = adminRole.Id, PermissionId = p.Id })
            .ToList();

        if (newRolePerms.Count > 0)
        {
            db.RolePermissions.AddRange(newRolePerms);
            await db.SaveChangesAsync();
        }

        // ── Admin user ────────────────────────────────────────────────────────
        if (!await db.Users.AnyAsync(u => u.Email == "admin@demopos.com"))
        {
            db.Users.Add(new User
            {
                Name              = "Admin",
                Email             = "admin@demopos.com",
                Username          = "admin",
                PasswordHash      = BCrypt.Net.BCrypt.HashPassword("admin1234"),
                RoleId            = adminRole.Id,
                EmailVerifiedAt   = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        // ── Units ─────────────────────────────────────────────────────────────
        // Seeded by ShortName so each entry is idempotent on re-run.
        var unitDefs = new (string Title, string ShortName)[]
        {
            ("Bag",    "bag"),
            ("Bottle", "btl"),
            ("Box",    "box"),
            ("Card",   "card"),
            ("Unit",   "unit"),
        };

        foreach (var (title, shortName) in unitDefs)
        {
            if (!await db.Units.AnyAsync(u => u.ShortName == shortName))
            {
                db.Units.Add(new Unit
                {
                    Title     = title,
                    ShortName = shortName,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
        }
        await db.SaveChangesAsync();

        // ── Default Walking Customer ──────────────────────────────────────────
        if (!await db.Customers.AnyAsync())
        {
            db.Customers.Add(new Customer
            {
                Name      = "Walking Customer",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        // ── Suppliers ─────────────────────────────────────────────────────────
        // id=1 (Own Supplier) is the protected default.
        // Local ingredient suppliers are seeded by name — idempotent on re-run.
        if (!await db.Suppliers.AnyAsync())
        {
            db.Suppliers.Add(new Supplier
            {
                Name      = "Own Supplier",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        var supplierNames = new[] { "Supplier A", "Supplier B", "Supplier C", "Supplier D" };
        foreach (var name in supplierNames)
        {
            if (!await db.Suppliers.AnyAsync(s => s.Name == name))
            {
                db.Suppliers.Add(new Supplier
                {
                    Name      = name,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
        }
        await db.SaveChangesAsync();

        // ── Payment Methods ───────────────────────────────────────────────────
        // QR Code (e-wallet / QR payment) is distinct from card in
        // AutoFillAmount=true like Bank Transfer.
        if (!await db.PaymentMethods.AnyAsync())
        {
            db.PaymentMethods.AddRange(
                new PaymentMethod { Name = "Cash",          IsActive = true, IsDefault = true,  SortOrder = 1, AutoFillAmount = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new PaymentMethod { Name = "Card",          IsActive = true, IsDefault = false, SortOrder = 2, AutoFillAmount = true,  CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new PaymentMethod { Name = "QR Code",       IsActive = true, IsDefault = false, SortOrder = 3, AutoFillAmount = true,  CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new PaymentMethod { Name = "Bank Transfer", IsActive = true, IsDefault = false, SortOrder = 4, AutoFillAmount = true,  CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new PaymentMethod { Name = "Member",        IsActive = true, IsDefault = false, SortOrder = 5, AutoFillAmount = false, ZeroTotal = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
            );
            await db.SaveChangesAsync();
        }

        // ── Currency ──────────────────────────────────────────────────────────
        // On a fresh database only MYR is seeded as the active currency.
        // Additional currencies can be added by the admin via the UI if needed.
        if (!await db.Currencies.AnyAsync())
        {
            db.Currencies.Add(
                new Currency { Name = "Malaysian Ringgit", Code = "MYR", Symbol = "RM", Active = true }
            );
            await db.SaveChangesAsync();
        }

        // ── Settings ──────────────────────────────────────────────────────────
        if (!await db.Settings.AnyAsync())
        {
            db.Settings.AddRange(
                // General
                new Setting { Key = "site_name",        Value = "Demo Store",         Group = "general"  },
                new Setting { Key = "site_url",          Value = "",                  Group = "general"  },
                new Setting { Key = "meta_description",  Value = "",                  Group = "general"  },
                // Contacts
                new Setting { Key = "contact_phone",     Value = "",                  Group = "contacts" },
                new Setting { Key = "contact_email",     Value = "",                  Group = "contacts" },
                new Setting { Key = "contact_address",   Value = "",                  Group = "contacts" },
                new Setting { Key = "contact_fax",       Value = "",                  Group = "contacts" },
                new Setting { Key = "contact_mobile",    Value = "",                  Group = "contacts" },
                new Setting { Key = "working_hour",      Value = "",                  Group = "contacts" },
                // Invoice
                new Setting { Key = "note_to_customer",  Value = "Thank you for your purchase!", Group = "invoice" },
                new Setting { Key = "receipt_maxwidth",  Value = "medium",            Group = "invoice"  },
                new Setting { Key = "is_show_logo",      Value = "true",              Group = "invoice"  },
                new Setting { Key = "is_show_site_name", Value = "true",              Group = "invoice"  },
                new Setting { Key = "is_show_phone",     Value = "true",              Group = "invoice"  },
                new Setting { Key = "is_show_email",     Value = "true",              Group = "invoice"  },
                new Setting { Key = "is_show_address",   Value = "true",              Group = "invoice"  },
                new Setting { Key = "is_show_customer",  Value = "true",              Group = "invoice"  },
                new Setting { Key = "is_show_note",      Value = "true",              Group = "invoice"  }
            );
            await db.SaveChangesAsync();
        }

        // ── Appearance setting (Module17) ─────────────────────────────────────
        if (!await db.Settings.AnyAsync(s => s.Key == "dark_mode"))
        {
            db.Settings.Add(new Setting { Key = "dark_mode", Value = "false", Group = "general" });
            await db.SaveChangesAsync();
        }

        // ── Rounding settings (Module18) ──────────────────────────────────────
        if (!await db.Settings.AnyAsync(s => s.Key == "rounding_enabled"))
        {
            db.Settings.Add(new Setting { Key = "rounding_enabled", Value = "false", Group = "general" });
            await db.SaveChangesAsync();
        }

        if (!await db.Settings.AnyAsync(s => s.Key == "rounding_quantum"))
        {
            db.Settings.Add(new Setting { Key = "rounding_quantum", Value = "0.05", Group = "general" });
            await db.SaveChangesAsync();
        }

        // ── Demo roles (Cashier / Manager / Staff / User read-only) ─────────────
        await SeedDemoRolesAsync(db);

        // ── Demo product catalog ──────────────────────────────────────────────
        await SeedDemoCatalogAsync(db);

        // ── 6-month showcase data (sales, purchases, customers) ───────────────
        await ShowcaseSeeder.SeedAsync(db);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Demo roles — create Cashier / Manager / Staff / User roles with realistic
    // permission sets so the demo showcases role-based access control.
    // Idempotent: only inserts missing roles and missing role-permission rows.
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedDemoRolesAsync(AppDbContext db)
    {
        // Permission sets per role name
        var roleDefs = new Dictionary<string, string[]>
        {
            // Read-only showcase account — can browse everything except admin screens
            ["User"] =
            [
                "dashboard_view",
                "sale_view",
                "customer_view", "customer_sales",
                "product_view",
                "brand_view", "category_view", "unit_view",
                "purchase_view",
                "supplier_view",
                "payment_method_view",
                "currency_view",
                "reports_summary", "reports_sales", "reports_inventory", "reports_purchases",
                "assembly_view",
                "product_bundle_view",
                "table_view",
                "modifier_view",
                "voucher_view",
                "role_view",
                "user_view",
            ],

            // POS cashier — create and view sales, basic customer lookup
            ["Cashier"] =
            [
                "dashboard_view",
                "sale_create", "sale_view",
                "customer_create", "customer_view",
                "product_view",
                "payment_method_view",
                "table_view",
            ],

            // Manager — POS + purchasing visibility + full reporting
            ["Manager"] =
            [
                "dashboard_view",
                "sale_create", "sale_view", "sale_update",
                "customer_create", "customer_view", "customer_update", "customer_sales",
                "purchase_view",
                "product_view", "product_create", "product_update",
                "brand_view", "category_view", "unit_view",
                "supplier_view",
                "payment_method_view",
                "reports_summary", "reports_sales", "reports_inventory", "reports_purchases",
                "assembly_view",
                "product_bundle_view",
                "table_view",
                "modifier_view",
                "voucher_view",
            ],

            // Staff — basic POS + view only
            ["Staff"] =
            [
                "dashboard_view",
                "sale_create", "sale_view",
                "customer_view",
                "product_view",
                "payment_method_view",
                "table_view",
            ],
        };

        var allPerms = await db.Permissions.AsNoTracking()
            .ToDictionaryAsync(p => p.Name, p => p.Id);

        foreach (var (roleName, permNames) in roleDefs)
        {
            var role = await db.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Name == roleName);

            if (role == null)
            {
                role = new Role { Name = roleName };
                db.Roles.Add(role);
                await db.SaveChangesAsync();
            }

            var existingPermIds = role.RolePermissions
                .Select(rp => rp.PermissionId)
                .ToHashSet();

            var toAdd = permNames
                .Where(n => allPerms.ContainsKey(n) && !existingPermIds.Contains(allPerms[n]))
                .Select(n => new RolePermission { RoleId = role.Id, PermissionId = allPerms[n] })
                .ToList();

            if (toAdd.Count > 0)
            {
                db.RolePermissions.AddRange(toAdd);
                await db.SaveChangesAsync();
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Demo product catalog.
    //
    // All blocks are idempotent: categories and brands check by name before
    // inserting. Products are skipped entirely if any product row already exists
    // so a re-run after seeding never duplicates data.
    // ─────────────────────────────────────────────────────────────────────────
    private static async Task SeedDemoCatalogAsync(AppDbContext db)
    {
        // ── Brand ─────────────────────────────────────────────────────────────
        if (!await db.Brands.AnyAsync(b => b.Name == "Demo Brand"))
        {
            db.Brands.Add(new Brand
            {
                Name      = "Demo Brand",
                Status    = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        // ── Categories ────────────────────────────────────────────────────────
        var categoryDefs = new[]
        {
            "Beverages",
            "Snacks",
            "Health Products",
            "Supplements",
            "Membership Cards",
            "Miscellaneous",
        };

        foreach (var catName in categoryDefs)
        {
            if (!await db.Categories.AnyAsync(c => c.Name == catName))
            {
                db.Categories.Add(new Category
                {
                    Name      = catName,
                    Status    = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
        }
        await db.SaveChangesAsync();

        // ── Products ──────────────────────────────────────────────────────────
        // Skip if ANY product already exists — prevents duplicate seeding.
        if (await db.Products.AnyAsync())
            return;

        // Resolve FK IDs by name — safe regardless of auto-increment order.
        var catBev   = await db.Categories.AsNoTracking().FirstAsync(c => c.Name == "Beverages");
        var catSnack = await db.Categories.AsNoTracking().FirstAsync(c => c.Name == "Snacks");
        var catHealth = await db.Categories.AsNoTracking().FirstAsync(c => c.Name == "Health Products");
        var catSupp  = await db.Categories.AsNoTracking().FirstAsync(c => c.Name == "Supplements");
        var catCard  = await db.Categories.AsNoTracking().FirstAsync(c => c.Name == "Membership Cards");

        var brand = await db.Brands.AsNoTracking().FirstAsync(b => b.Name == "Demo Brand");

        var unitBtl  = await db.Units.AsNoTracking().FirstAsync(u => u.ShortName == "btl");
        var unitBox  = await db.Units.AsNoTracking().FirstAsync(u => u.ShortName == "box");
        var unitCard = await db.Units.AsNoTracking().FirstAsync(u => u.ShortName == "card");
        var unitUnit = await db.Units.AsNoTracking().FirstAsync(u => u.ShortName == "unit");

        var now = DateTime.UtcNow;

        // ── Beverages ─────────────────────────────────────────────────────────
        var beverages = new[]
        {
            ("Demo Juice Original", "demo-juice-original", "BV-001"),
            ("Demo Juice Orange",   "demo-juice-orange",   "BV-002"),
            ("Demo Juice Mango",    "demo-juice-mango",    "BV-003"),
        };

        foreach (var (name, slug, sku) in beverages)
        {
            db.Products.Add(new Product
            {
                Name          = name,
                Slug          = slug,
                Sku           = sku,
                CategoryId    = catBev.Id,
                BrandId       = brand.Id,
                UnitId        = unitBtl.Id,
                PurchasePrice = 5.00m,
                Price         = 8.00m,
                Discount      = null,
                DiscountType  = null,
                Quantity      = 0,
                Status        = true,
                PosEnabled    = true,
                Image         = null,
                CreatedAt     = now,
                UpdatedAt     = now,
            });
        }

        // ── Health Products ───────────────────────────────────────────────────
        var healthProducts = new[]
        {
            ("Health Mix A 100g", "health-mix-a-100g", "HP-001", 15.00m, 8.00m),
            ("Health Mix B 100g", "health-mix-b-100g", "HP-002", 15.00m, 8.00m),
            ("Health Mix C  50g", "health-mix-c-50g",  "HP-003", 10.00m, 5.00m),
        };

        foreach (var (name, slug, sku, price, purchasePrice) in healthProducts)
        {
            db.Products.Add(new Product
            {
                Name          = name,
                Slug          = slug,
                Sku           = sku,
                CategoryId    = catHealth.Id,
                BrandId       = brand.Id,
                UnitId        = unitBox.Id,
                PurchasePrice = purchasePrice,
                Price         = price,
                Discount      = null,
                DiscountType  = null,
                Quantity      = 0,
                Status        = true,
                PosEnabled    = true,
                Image         = null,
                CreatedAt     = now,
                UpdatedAt     = now,
            });
        }

        // ── Supplements ───────────────────────────────────────────────────────
        var supplements = new[]
        {
            ("Supplement A", "supplement-a", "SP-001", 20.00m, 10.00m),
            ("Supplement B", "supplement-b", "SP-002", 35.00m, 18.00m),
            ("Supplement C", "supplement-c", "SP-003", 50.00m, 25.00m),
        };

        foreach (var (name, slug, sku, price, purchasePrice) in supplements)
        {
            db.Products.Add(new Product
            {
                Name          = name,
                Slug          = slug,
                Sku           = sku,
                CategoryId    = catSupp.Id,
                BrandId       = brand.Id,
                UnitId        = unitUnit.Id,
                PurchasePrice = purchasePrice,
                Price         = price,
                Discount      = null,
                DiscountType  = null,
                Quantity      = 0,
                Status        = true,
                PosEnabled    = true,
                Image         = null,
                CreatedAt     = now,
                UpdatedAt     = now,
            });
        }

        // ── Membership Cards ──────────────────────────────────────────────────
        // Quantity = 999 (unlimited — not physical stock).
        var membershipCards = new[]
        {
            ("7-Day Card",  "7-day-card",  "MC-001",  50.00m),
            ("30-Day Card", "30-day-card", "MC-002", 150.00m),
            ("90-Day Card", "90-day-card", "MC-003", 380.00m),
        };

        foreach (var (name, slug, sku, price) in membershipCards)
        {
            db.Products.Add(new Product
            {
                Name          = name,
                Slug          = slug,
                Sku           = sku,
                CategoryId    = catCard.Id,
                BrandId       = brand.Id,
                UnitId        = unitCard.Id,
                PurchasePrice = 0m,
                Price         = price,
                Discount      = null,
                DiscountType  = null,
                Quantity      = 999,
                Status        = true,
                PosEnabled    = true,
                Image         = null,
                CreatedAt     = now,
                UpdatedAt     = now,
            });
        }

        await db.SaveChangesAsync();
    }
}
