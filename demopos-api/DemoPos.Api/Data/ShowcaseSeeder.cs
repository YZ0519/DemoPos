using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Constants;
using DemoPos.Api.Models;

namespace DemoPos.Api.Data;

/// <summary>
/// Seeds six months of realistic showcase data.
/// Idempotent: does nothing if Sales rows already exist.
///
/// Covers:
///   - 5 non-admin demo users
///   - 20 named customers
///   - 10 restaurant tables
///   - 2 assembly kit products
///   - 2 assembly templates + 8 monthly assembly runs
///   - 24 purchase orders
///   - ~1 000 sales (POS / takeaway / dine-in) with 0.05 cash rounding
/// </summary>
public static class ShowcaseSeeder
{
    private static readonly Random Rng = new(2025);   // fixed → reproducible

    private static readonly DateTime EndDate   = DateTime.UtcNow.Date.AddDays(-1);
    private static readonly DateTime StartDate = EndDate.AddMonths(-6);

    // ── Entry point ───────────────────────────────────────────────────────────
    public static async Task SeedAsync(AppDbContext db)
    {
        if (await db.Sales.AnyAsync()) return;

        await EnableRoundingAsync(db);
        await SeedDemoUsersAsync(db);
        await SeedCustomersAsync(db);
        await SeedTablesAsync(db);
        await SeedAssemblyProductsAsync(db);
        await SeedAssemblyTemplatesAsync(db);
        await SeedPurchasesAsync(db);
        await SeedAssemblyRunsAsync(db);
        await SeedSalesAsync(db);
        await UpdateProductQuantitiesAsync(db);
    }

    // ── 1. Enable rounding (0.05 quantum) ─────────────────────────────────────
    private static async Task EnableRoundingAsync(AppDbContext db)
    {
        var enabled = await db.Settings.FirstOrDefaultAsync(s => s.Key == "rounding_enabled");
        if (enabled != null) { enabled.Value = "true"; }

        var quantum = await db.Settings.FirstOrDefaultAsync(s => s.Key == "rounding_quantum");
        if (quantum != null) { quantum.Value = "0.05"; }

        await db.SaveChangesAsync();
    }

    // ── 2. Demo users — each mapped to a purpose-built role ───────────────────
    private static async Task SeedDemoUsersAsync(AppDbContext db)
    {
        // Resolve roles by name — they are created in SeedData.SeedDemoRolesAsync
        // which always runs before ShowcaseSeeder.SeedAsync.
        var roles = await db.Roles.AsNoTracking()
            .ToDictionaryAsync(r => r.Name, r => r.Id);

        int RoleId(string name) => roles.GetValueOrDefault(name,
            roles.GetValueOrDefault("User", 2));

        var users = new[]
        {
            // name           email                       username    password       role
            ("Demo User",  "demo@demopos.com",     "demo",     "demo1234",    RoleId("User")),
            ("Cashier",    "cashier@demopos.com",  "cashier",  "cashier1234", RoleId("Cashier")),
            ("Cashier 2",  "cashier2@demopos.com", "cashier2", "cashier1234", RoleId("Cashier")),
            ("Manager",    "manager@demopos.com",  "manager",  "manager1234", RoleId("Manager")),
            ("Staff",      "staff@demopos.com",    "staff",    "staff1234",   RoleId("Staff")),
        };

        foreach (var (name, email, username, password, roleId) in users)
        {
            if (await db.Users.AnyAsync(u => u.Email == email)) continue;
            db.Users.Add(new User
            {
                Name            = name,
                Email           = email,
                Username        = username,
                PasswordHash    = BCrypt.Net.BCrypt.HashPassword(password),
                RoleId          = roleId,
                EmailVerifiedAt = DateTime.UtcNow,
                CreatedAt       = DateTime.UtcNow,
                UpdatedAt       = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 3. 20 named customers ─────────────────────────────────────────────────
    private static async Task SeedCustomersAsync(AppDbContext db)
    {
        if (await db.Customers.CountAsync() > 1) return;

        var regulars = new[]
        {
            ("Alice Tan",    "+601-1234-5001"),
            ("Bob Lim",      "+601-1234-5002"),
            ("Carol Ng",     "+601-1234-5003"),
            ("David Wong",   "+601-1234-5004"),
            ("Emma Lee",     "+601-1234-5005"),
            ("Frank Ong",    "+601-1234-5006"),
            ("Grace Toh",    "+601-1234-5007"),
            ("Henry Sim",    "+601-1234-5008"),
            ("Irene Koh",    "+601-1234-5009"),
            ("James Yap",    "+601-1234-5010"),
            ("Karen Wee",    "+601-1234-5011"),
            ("Leon Choo",    "+601-1234-5012"),
            ("Mary Ho",      "+601-1234-5013"),
            ("Nick Tan",     "+601-1234-5014"),
            ("Olivia Chan",  "+601-1234-5015"),
            ("Peter Lau",    "+601-1234-5016"),
            ("Queen Foo",    "+601-1234-5017"),
            ("Raymond Goh",  "+601-1234-5018"),
            ("Sarah Pang",   "+601-1234-5019"),
            ("Tom Ang",      "+601-1234-5020"),
        };

        foreach (var (name, phone) in regulars)
        {
            db.Customers.Add(new Customer
            {
                Name      = name,
                Phone     = phone,
                CreatedAt = StartDate.AddDays(-Rng.Next(1, 60)),
                UpdatedAt = StartDate.AddDays(-Rng.Next(1, 30)),
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 4. 10 restaurant tables ───────────────────────────────────────────────
    private static async Task SeedTablesAsync(AppDbContext db)
    {
        if (await db.RestaurantTables.AnyAsync()) return;

        var tableDefs = new[]
        {
            (1,  "Window A",    2),
            (2,  "Window B",    2),
            (3,  "Corner",      4),
            (4,  "Main Hall A", 4),
            (5,  "Main Hall B", 4),
            (6,  "Main Hall C", 4),
            (7,  "VIP 1",       6),
            (8,  "VIP 2",       6),
            (9,  "Outdoor A",   4),
            (10, "Outdoor B",   4),
        };

        for (int i = 0; i < tableDefs.Length; i++)
        {
            var (num, label, cap) = tableDefs[i];
            db.RestaurantTables.Add(new RestaurantTable
            {
                Number    = num,
                Label     = label,
                Capacity  = cap,
                Status    = TableStatuses.Available,
                IsActive  = true,
                SortOrder = i,
                CreatedAt = StartDate.AddDays(-30),
                UpdatedAt = StartDate.AddDays(-30),
            });
        }
        await db.SaveChangesAsync();
    }

    // ── 5. Assembly kit products ──────────────────────────────────────────────
    private static async Task SeedAssemblyProductsAsync(AppDbContext db)
    {
        // Wellness Combo Pack — produced by assembly, sold at POS
        if (!await db.Products.AnyAsync(p => p.Sku == "WC-001"))
        {
            var miscCat  = await db.Categories.FirstOrDefaultAsync(c => c.Name == "Miscellaneous");
            var demoBrand = await db.Brands.FirstOrDefaultAsync(b => b.Name == "Demo Brand");
            var unitUnit  = await db.Units.FirstOrDefaultAsync(u => u.ShortName == "unit");

            db.Products.Add(new Product
            {
                Name          = "Wellness Combo Pack",
                Slug          = "wellness-combo-pack",
                Sku           = "WC-001",
                CategoryId    = miscCat?.Id,
                BrandId       = demoBrand?.Id,
                UnitId        = unitUnit?.Id,
                Price         = 25.00m,
                PurchasePrice = 0m,
                Quantity      = 0,
                Status        = true,
                PosEnabled    = true,
                CreatedAt     = StartDate.AddDays(-30),
                UpdatedAt     = StartDate.AddDays(-30),
            });
        }

        // Bulk Supplement Supply — input for split assembly, not sold at POS
        if (!await db.Products.AnyAsync(p => p.Sku == "BS-001"))
        {
            var suppCat   = await db.Categories.FirstOrDefaultAsync(c => c.Name == "Supplements");
            var demoBrand = await db.Brands.FirstOrDefaultAsync(b => b.Name == "Demo Brand");
            var unitUnit  = await db.Units.FirstOrDefaultAsync(u => u.ShortName == "unit");

            db.Products.Add(new Product
            {
                Name          = "Bulk Supplement Supply",
                Slug          = "bulk-supplement-supply",
                Sku           = "BS-001",
                CategoryId    = suppCat?.Id,
                BrandId       = demoBrand?.Id,
                UnitId        = unitUnit?.Id,
                Price         = 80.00m,
                PurchasePrice = 50.00m,
                Quantity      = 0,
                Status        = true,
                PosEnabled    = false,   // internal use only
                CreatedAt     = StartDate.AddDays(-30),
                UpdatedAt     = StartDate.AddDays(-30),
            });
        }

        await db.SaveChangesAsync();
    }

    // ── 6. Assembly templates ─────────────────────────────────────────────────
    private static async Task SeedAssemblyTemplatesAsync(AppDbContext db)
    {
        if (await db.AssemblyTemplates.AnyAsync()) return;

        var juiceOriginal    = await db.Products.FirstAsync(p => p.Sku == "BV-001");
        var supplementA      = await db.Products.FirstAsync(p => p.Sku == "SP-001");
        var supplementC      = await db.Products.FirstAsync(p => p.Sku == "SP-003");
        var wellnessPack     = await db.Products.FirstAsync(p => p.Sku == "WC-001");
        var bulkSupply       = await db.Products.FirstAsync(p => p.Sku == "BS-001");

        // ── Template 1: Wellness Combo Pack (production) ──────────────────────
        var t1 = new AssemblyTemplate
        {
            Name            = "Wellness Combo Pack",
            AssemblyType    = "production",
            OutputProductId = wellnessPack.Id,
            DefaultYield    = 1,
            Description     = "Assemble 1 juice + 1 supplement A into a combo pack.",
            IsActive        = true,
            CreatedAt       = StartDate.AddDays(-25),
            UpdatedAt       = StartDate.AddDays(-25),
        };
        db.AssemblyTemplates.Add(t1);
        await db.SaveChangesAsync();

        db.AssemblyTemplateItems.AddRange(
            new AssemblyTemplateItem { AssemblyTemplateId = t1.Id, ProductId = juiceOriginal.Id, DefaultQuantity = 1, SortOrder = 1 },
            new AssemblyTemplateItem { AssemblyTemplateId = t1.Id, ProductId = supplementA.Id,   DefaultQuantity = 1, SortOrder = 2 }
        );

        // ── Template 2: Supplement Bulk Split (split) ─────────────────────────
        var t2 = new AssemblyTemplate
        {
            Name            = "Supplement Bulk Split",
            AssemblyType    = "split",
            OutputProductId = supplementC.Id,
            DefaultYield    = 5,
            Description     = "Split 1 bulk supply unit into 5 individual Supplement C units.",
            IsActive        = true,
            CreatedAt       = StartDate.AddDays(-25),
            UpdatedAt       = StartDate.AddDays(-25),
        };
        db.AssemblyTemplates.Add(t2);
        await db.SaveChangesAsync();

        db.AssemblyTemplateItems.Add(
            new AssemblyTemplateItem { AssemblyTemplateId = t2.Id, ProductId = bulkSupply.Id, DefaultQuantity = 1, SortOrder = 1 }
        );

        await db.SaveChangesAsync();
    }

    // ── 7. 24 purchase orders ─────────────────────────────────────────────────
    private static async Task SeedPurchasesAsync(AppDbContext db)
    {
        var products  = await db.Products.AsNoTracking().ToListAsync();
        var suppliers = await db.Suppliers.AsNoTracking().ToListAsync();
        var cashPm    = await db.PaymentMethods.AsNoTracking().FirstOrDefaultAsync(p => p.Name == "Cash");
        var adminUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == "admin");

        if (!products.Any() || suppliers.Count < 2) return;

        var beverages   = products.Where(p => p.Sku.StartsWith("BV")).ToList();
        var healthProds = products.Where(p => p.Sku.StartsWith("HP")).ToList();
        var supps       = products.Where(p => p.Sku.StartsWith("SP")).ToList();
        var bulk        = products.Where(p => p.Sku == "BS-001").ToList();

        var purchaseDate = StartDate.AddDays(Rng.Next(1, 5));
        int orderCount   = 0;

        while (purchaseDate <= EndDate && orderCount < 24)
        {
            var supplier = suppliers[orderCount % 2 == 0 ? 1 : (suppliers.Count > 2 ? 2 : 1)];

            var purchase = new Purchase
            {
                SupplierId  = supplier.Id,
                UserId      = adminUser?.Id,
                Date        = purchaseDate,
                Status      = 1,
                DiscountType = "fixed",
                CreatedAt   = purchaseDate,
                UpdatedAt   = purchaseDate,
            };

            var items = new List<PurchaseItem>();

            // Beverages — every order
            foreach (var p in beverages)
                items.Add(MakePurchaseItem(p, Rng.Next(40, 101), purchaseDate));

            // Health products — every other order
            if (orderCount % 2 == 0)
                foreach (var p in healthProds)
                    items.Add(MakePurchaseItem(p, Rng.Next(15, 41), purchaseDate));

            // Supplements — every third order
            if (orderCount % 3 == 0)
                foreach (var p in supps)
                    items.Add(MakePurchaseItem(p, Rng.Next(8, 21), purchaseDate));

            // Bulk supplement supply — every 4th order (used in assembly)
            if (orderCount % 4 == 0)
                foreach (var p in bulk)
                    items.Add(MakePurchaseItem(p, Rng.Next(5, 11), purchaseDate));

            decimal subTotal = items.Sum(i => i.PurchasePrice * i.Quantity);
            purchase.SubTotal   = subTotal;
            purchase.GrandTotal = subTotal;
            purchase.AmountPaid = subTotal;
            purchase.AmountDue  = 0;

            db.Purchases.Add(purchase);
            await db.SaveChangesAsync();

            foreach (var item in items) item.PurchaseId = purchase.Id;
            db.PurchaseItems.AddRange(items);

            if (cashPm != null)
            {
                db.PurchaseTransactions.Add(new PurchaseTransaction
                {
                    PurchaseId      = purchase.Id,
                    SupplierId      = supplier.Id,
                    UserId          = adminUser?.Id,
                    Amount          = subTotal,
                    PaidBy          = "cash",
                    PaymentMethodId = cashPm.Id,
                    CreatedAt       = purchaseDate,
                    UpdatedAt       = purchaseDate,
                });
            }

            await db.SaveChangesAsync();

            purchaseDate = purchaseDate.AddDays(Rng.Next(6, 10));
            orderCount++;
        }
    }

    private static PurchaseItem MakePurchaseItem(Product p, int qty, DateTime ts) =>
        new()
        {
            ProductId     = p.Id,
            PurchasePrice = p.PurchasePrice,
            Price         = p.Price,
            Quantity      = qty,
            CreatedAt     = ts,
            UpdatedAt     = ts,
        };

    // ── 8. Assembly runs (monthly, ~8 total) ──────────────────────────────────
    private static async Task SeedAssemblyRunsAsync(AppDbContext db)
    {
        if (await db.StockAssemblies.AnyAsync()) return;

        var template1 = await db.AssemblyTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Name == "Wellness Combo Pack");
        var template2 = await db.AssemblyTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Name == "Supplement Bulk Split");

        var adminUser = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == "admin");

        if (template1 == null || template2 == null) return;

        var inputPrices = await db.Products.AsNoTracking()
            .ToDictionaryAsync(p => p.Id, p => p.PurchasePrice);

        // One production run per month (6 months = 6 runs for template1)
        for (int m = 0; m < 6; m++)
        {
            var runDate  = StartDate.AddMonths(m).AddDays(Rng.Next(3, 8));
            int yieldQty = Rng.Next(8, 16);

            var items = template1.Items.Select(ti => new StockAssemblyItem
            {
                ProductId       = ti.ProductId,
                QuantityUsed    = (decimal)yieldQty * ti.DefaultQuantity,
                WasteQuantity   = 0,
                UnitCostAtTime  = inputPrices.GetValueOrDefault(ti.ProductId, 0m),
            }).ToList();

            decimal totalCost   = items.Sum(i => i.QuantityUsed * i.UnitCostAtTime);
            decimal costPerUnit = yieldQty > 0 ? Math.Round(totalCost / yieldQty, 4) : 0m;

            var assembly = new StockAssembly
            {
                AssemblyTemplateId = template1.Id,
                AssemblyType       = template1.AssemblyType,
                OutputProductId    = template1.OutputProductId,
                OutputQuantity     = yieldQty,
                OutputCostPerUnit  = costPerUnit,
                TriggeredBy        = "manual",
                UserId             = adminUser?.Id,
                Note               = $"Monthly production run {m + 1}",
                AssembledAt        = runDate,
                CreatedAt          = runDate,
                UpdatedAt          = runDate,
                Items              = items,
            };
            db.StockAssemblies.Add(assembly);
        }

        // One split run every 2 months (3 runs for template2)
        for (int m = 0; m < 6; m += 2)
        {
            var runDate    = StartDate.AddMonths(m).AddDays(Rng.Next(10, 18));
            int inputUnits = Rng.Next(3, 7);
            int yield      = inputUnits * (int)template2.DefaultYield;

            var items = template2.Items.Select(ti => new StockAssemblyItem
            {
                ProductId       = ti.ProductId,
                QuantityUsed    = inputUnits * ti.DefaultQuantity,
                WasteQuantity   = 0,
                UnitCostAtTime  = inputPrices.GetValueOrDefault(ti.ProductId, 0m),
            }).ToList();

            decimal totalCost   = items.Sum(i => i.QuantityUsed * i.UnitCostAtTime);
            decimal costPerUnit = yield > 0 ? Math.Round(totalCost / yield, 4) : 0m;

            var assembly = new StockAssembly
            {
                AssemblyTemplateId = template2.Id,
                AssemblyType       = template2.AssemblyType,
                OutputProductId    = template2.OutputProductId,
                OutputQuantity     = yield,
                OutputCostPerUnit  = costPerUnit,
                TriggeredBy        = "manual",
                UserId             = adminUser?.Id,
                Note               = $"Bulk split run {m / 2 + 1}",
                AssembledAt        = runDate,
                CreatedAt          = runDate,
                UpdatedAt          = runDate,
                Items              = items,
            };
            db.StockAssemblies.Add(assembly);
        }

        await db.SaveChangesAsync();
    }

    // ── 9. ~1 000 sales (POS + takeaway + dine-in, with 0.05 rounding) ────────
    private static async Task SeedSalesAsync(AppDbContext db)
    {
        var products       = await db.Products.AsNoTracking().Where(p => p.Status).ToListAsync();
        var customers      = await db.Customers.AsNoTracking().ToListAsync();
        var paymentMethods = await db.PaymentMethods.AsNoTracking().ToListAsync();
        var tables         = await db.RestaurantTables.AsNoTracking().ToListAsync();
        var allUsers       = await db.Users.AsNoTracking().ToListAsync();

        if (!products.Any() || !customers.Any() || !paymentMethods.Any()) return;

        var walkingCustomer = customers.First(c => c.Name == "Walking Customer");
        var regulars        = customers.Where(c => c.Name != "Walking Customer").ToList();

        var cashPm = paymentMethods.First(p => p.Name == "Cash");
        var qrPm   = paymentMethods.FirstOrDefault(p => p.Name == "QR Code") ?? cashPm;
        var cardPm = paymentMethods.FirstOrDefault(p => p.Name == "Card")    ?? cashPm;

        // Staff who process sales
        var salesStaff = allUsers
            .Where(u => new[] { "admin", "cashier", "cashier2" }.Contains(u.Username))
            .ToList();
        if (!salesStaff.Any()) salesStaff = allUsers.Take(1).ToList();

        var beverages   = products.Where(p => p.Sku.StartsWith("BV")).ToList();
        var healthProds = products.Where(p => p.Sku.StartsWith("HP")).ToList();
        var supps       = products.Where(p => p.Sku.StartsWith("SP")).ToList();
        var cards       = products.Where(p => p.Sku.StartsWith("MC")).ToList();
        var kits        = products.Where(p => p.Sku.StartsWith("WC") && p.PosEnabled).ToList();

        int totalDays = (EndDate - StartDate).Days + 1;

        for (int day = 0; day < totalDays; day++)
        {
            var date     = StartDate.AddDays(day);
            double prog  = (double)day / totalDays;
            double baseSales = 4 + prog * 5;    // ramp from 4 → 9 per day

            bool isWeekend = date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            int salesCount = (int)Math.Round(baseSales * (isWeekend ? 1.4 : 1.0))
                             + (Rng.Next(0, 3) - 1);
            salesCount = Math.Max(2, salesCount);

            for (int s = 0; s < salesCount; s++)
            {
                var saleTime = date.AddHours(9 + Rng.Next(0, 12))
                                   .AddMinutes(Rng.Next(0, 60));

                var staff    = salesStaff[Rng.Next(salesStaff.Count)];
                var customer = Rng.Next(100) < 40
                    ? regulars[Rng.Next(regulars.Count)]
                    : walkingCustomer;

                // Order type: 65% POS, 20% takeaway, 15% dine-in
                string orderType = Rng.Next(100) switch
                {
                    < 65 => OrderTypes.Pos,
                    < 85 => OrderTypes.Takeaway,
                    _    => OrderTypes.DineIn,
                };

                // Only dine-in gets a table
                RestaurantTable? table = orderType == OrderTypes.DineIn && tables.Any()
                    ? tables[Rng.Next(tables.Count)]
                    : null;

                var saleItems = BuildSaleItems(saleTime, beverages, healthProds, supps, cards, kits);
                if (saleItems.Count == 0) continue;

                decimal subTotal = saleItems.Sum(i => i.SubTotal);
                decimal total    = subTotal;

                // Apply 0.05 cash rounding
                var (roundedTotal, roundingAdj) = ApplyRounding(total);

                // Payment method: 55% cash, 30% QR, 15% card
                var pm = Rng.Next(100) switch
                {
                    < 55 => cashPm,
                    < 85 => qrPm,
                    _    => cardPm,
                };

                // Cash gets the rounded total; card/QR pay exact
                decimal effectivePaid = pm.Name == "Cash" ? roundedTotal : total;
                decimal effectiveTotal = pm.Name == "Cash" ? roundedTotal : total;
                decimal effectiveRounded = pm.Name == "Cash" ? roundedTotal : 0m;
                decimal effectiveAdj     = pm.Name == "Cash" ? roundingAdj : 0m;

                // Add takeaway charge for takeaway orders (occasional, small stores may charge)
                decimal takeawayCharge = orderType == OrderTypes.Takeaway && Rng.Next(100) < 30
                    ? 1.00m
                    : 0m;

                if (takeawayCharge > 0)
                {
                    effectiveTotal   += takeawayCharge;
                    effectivePaid    += takeawayCharge;
                    if (pm.Name == "Cash")
                    {
                        var (rt2, ra2)    = ApplyRounding(effectiveTotal);
                        effectiveRounded  = rt2;
                        effectiveAdj      = ra2;
                        effectivePaid     = rt2;
                    }
                }

                var sale = new Sale
                {
                    UserId             = staff.Id,
                    CustomerId         = customer.Id,
                    TableId            = table?.Id,
                    SubTotal           = subTotal,
                    Discount           = 0,
                    Total              = effectiveTotal,
                    RoundingAdjustment = effectiveAdj,
                    RoundedTotal       = effectiveRounded,
                    Paid               = effectivePaid,
                    Due                = 0,
                    Change             = 0,
                    Status             = 1,
                    OrderType          = orderType,
                    OrderStatus        = OrderStatuses.Paid,
                    TakeawayCharge     = takeawayCharge,
                    IsReturned         = false,
                    CreatedAt          = saleTime,
                    UpdatedAt          = saleTime,
                    OrderDate          = saleTime,
                };

                db.Sales.Add(sale);
                await db.SaveChangesAsync();

                foreach (var item in saleItems) item.SaleId = sale.Id;
                db.SaleItems.AddRange(saleItems);

                // Dine-in items get a KitchenSentAt timestamp
                if (orderType == OrderTypes.DineIn)
                    foreach (var item in saleItems)
                        item.KitchenSentAt = saleTime.AddMinutes(Rng.Next(1, 5));

                decimal paidAmount = effectivePaid;
                db.SaleTransactions.Add(new SaleTransaction
                {
                    SaleId          = sale.Id,
                    CustomerId      = customer.Id,
                    UserId          = staff.Id,
                    Amount          = paidAmount,
                    Change          = 0,
                    PaidBy          = pm.Name.ToLower().Replace(" ", "_"),
                    PaymentMethodId = pm.Id,
                    CreatedAt       = saleTime,
                    UpdatedAt       = saleTime,
                });

                await db.SaveChangesAsync();
            }
        }
    }

    // ── Build 1–3 sale items ──────────────────────────────────────────────────
    private static List<SaleItem> BuildSaleItems(
        DateTime ts,
        List<Product> beverages,
        List<Product> healthProds,
        List<Product> supps,
        List<Product> cards,
        List<Product> kits)
    {
        var items = new List<SaleItem>();

        // Primary item (weighted)
        // 50% beverage, 22% health, 12% supplement, 10% kit, 6% membership
        int roll = Rng.Next(100);
        Product? primary = roll switch
        {
            < 50 when beverages.Any()   => beverages[Rng.Next(beverages.Count)],
            < 72 when healthProds.Any() => healthProds[Rng.Next(healthProds.Count)],
            < 84 when supps.Any()       => supps[Rng.Next(supps.Count)],
            < 94 when kits.Any()        => kits[Rng.Next(kits.Count)],
            _    when cards.Any()       => cards[Rng.Next(cards.Count)],
            _                           => beverages.FirstOrDefault(),
        };

        if (primary == null) return items;

        bool isCard = primary.Sku.StartsWith("MC");
        int primaryQty = isCard ? 1 : Rng.Next(1, 4);
        items.Add(MakeSaleItem(ts, primary, primaryQty));

        // 45% chance of a second item (beverage upsell)
        if (!isCard && Rng.Next(100) < 45 && beverages.Any())
        {
            var second = beverages[Rng.Next(beverages.Count)];
            if (second.Id != primary.Id)
                items.Add(MakeSaleItem(ts, second, Rng.Next(1, 3)));
        }

        // 18% chance of a health add-on
        if (!isCard && Rng.Next(100) < 18 && healthProds.Any())
            items.Add(MakeSaleItem(ts, healthProds[Rng.Next(healthProds.Count)], 1));

        return items;
    }

    private static SaleItem MakeSaleItem(DateTime ts, Product p, int qty)
    {
        decimal subTotal = p.Price * qty;
        return new SaleItem
        {
            ProductId     = p.Id,
            Quantity      = qty,
            Price         = p.Price,
            PurchasePrice = p.PurchasePrice,
            SubTotal      = subTotal,
            Discount      = 0,
            Total         = subTotal,
            CreatedAt     = ts,
            UpdatedAt     = ts,
        };
    }

    // ── 10. Reconcile product quantities ──────────────────────────────────────
    private static async Task UpdateProductQuantitiesAsync(AppDbContext db)
    {
        var products = await db.Products.ToListAsync();

        var purchased = await db.PurchaseItems
            .AsNoTracking()
            .GroupBy(i => i.ProductId)
            .Select(g => new { g.Key, Qty = g.Sum(i => i.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Qty);

        var sold = await db.SaleItems
            .AsNoTracking()
            .Where(i => i.ProductId != null)
            .GroupBy(i => i.ProductId!.Value)
            .Select(g => new { g.Key, Qty = g.Sum(i => i.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Qty);

        // Assembly: output increases stock, inputs decrease stock
        var assemblyOut = await db.StockAssemblies
            .AsNoTracking()
            .GroupBy(a => a.OutputProductId)
            .Select(g => new { g.Key, Qty = g.Sum(a => (int)a.OutputQuantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Qty);

        var assemblyIn = await db.StockAssemblyItems
            .AsNoTracking()
            .GroupBy(i => i.ProductId)
            .Select(g => new { g.Key, Qty = g.Sum(i => (int)i.QuantityUsed) })
            .ToDictionaryAsync(x => x.Key, x => x.Qty);

        foreach (var p in products)
        {
            if (p.Sku.StartsWith("MC"))
            {
                p.Quantity = 999;
                continue;
            }

            int net = purchased.GetValueOrDefault(p.Id)
                    + assemblyOut.GetValueOrDefault(p.Id)
                    - sold.GetValueOrDefault(p.Id)
                    - assemblyIn.GetValueOrDefault(p.Id);

            p.Quantity = Math.Max(net, Rng.Next(3, 15));
        }

        await db.SaveChangesAsync();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Rounds to nearest 0.05 (same algorithm as SaleService.ApplyCashRounding).</summary>
    private static (decimal RoundedTotal, decimal Adjustment) ApplyRounding(decimal total)
    {
        int totalCents   = (int)Math.Round(total * 100m, MidpointRounding.AwayFromZero);
        const int q      = 5;  // 0.05 * 100
        int remainder    = totalCents % q;
        int roundedCents = remainder * 2 < q
            ? totalCents - remainder
            : totalCents + (q - remainder);
        decimal rounded  = roundedCents / 100m;
        return (rounded, rounded - total);
    }
}
