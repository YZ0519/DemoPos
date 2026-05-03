using Microsoft.EntityFrameworkCore;
using DemoPos.Api.Constants;
using DemoPos.Api.Models;

namespace DemoPos.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<ForgetPassword> ForgetPasswords => Set<ForgetPassword>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // ── Module 3 ──────────────────────────────────────────────────────────────
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Product> Products => Set<Product>();

    // ── Module 7 ──────────────────────────────────────────────────────────────
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();

    // ── Module 5 ──────────────────────────────────────────────────────────────
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<SaleTransaction> SaleTransactions => Set<SaleTransaction>();

    // ── Module 6 ──────────────────────────────────────────────────────────────
    public DbSet<Purchase> Purchases => Set<Purchase>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<PurchaseTransaction> PurchaseTransactions => Set<PurchaseTransaction>();

    // ── Module 4 ──────────────────────────────────────────────────────────────
    public DbSet<PosCart> PosCarts => Set<PosCart>();

    // ── Module 11 ─────────────────────────────────────────────────────────────
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();

    // ── Module 10 ─────────────────────────────────────────────────────────────
    public DbSet<Currency> Currencies => Set<Currency>();

    // ── Module 11 (Settings) ──────────────────────────────────────────────────
    public DbSet<Setting> Settings => Set<Setting>();

    // ── Module 15 (Stock Assembly) ────────────────────────────────────────────
    public DbSet<AssemblyTemplate> AssemblyTemplates => Set<AssemblyTemplate>();
    public DbSet<AssemblyTemplateItem> AssemblyTemplateItems => Set<AssemblyTemplateItem>();
    public DbSet<StockAssembly> StockAssemblies => Set<StockAssembly>();
    public DbSet<StockAssemblyItem> StockAssemblyItems => Set<StockAssemblyItem>();

    // ── Module 22 (Audit Log) ─────────────────────────────────────────────────
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // ── Stock Bundle ──────────────────────────────────────────────────────────
    public DbSet<ProductBundle> ProductBundles => Set<ProductBundle>();

    // ── Multi-Step Bundle Selection ─────────────────────────────────────────
    public DbSet<BundleStep> BundleSteps => Set<BundleStep>();
    public DbSet<BundleStepProduct> BundleStepProducts => Set<BundleStepProduct>();

    // ── Restaurant R1 (Table Management) ──────────────────────────────────────
    public DbSet<RestaurantTable> RestaurantTables => Set<RestaurantTable>();

    // ── Restaurant R4 (Item Modifiers) ────────────────────────────────────────
    public DbSet<ProductModifierGroup> ProductModifierGroups => Set<ProductModifierGroup>();
    public DbSet<ProductModifierOption> ProductModifierOptions => Set<ProductModifierOption>();

    // ── Restaurant R5 (Combo Meals) ───────────────────────────────────────────
    public DbSet<ComboItem> ComboItems => Set<ComboItem>();

    // ── Restaurant R9 (Voucher Packages) ──────────────────────────────────────
    public DbSet<VoucherPackage> VoucherPackages => Set<VoucherPackage>();
    public DbSet<VoucherPackageItem> VoucherPackageItems => Set<VoucherPackageItem>();

    // ── Restaurant R8 (Table Merge) ───────────────────────────────────────────
    public DbSet<TableMerge> TableMerges => Set<TableMerge>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── RolePermission ────────────────────────────────────────────────────
        modelBuilder.Entity<RolePermission>()
            .HasKey(rp => new { rp.RoleId, rp.PermissionId });

        modelBuilder.Entity<RolePermission>()
            .HasOne(rp => rp.Role)
            .WithMany(r => r.RolePermissions)
            .HasForeignKey(rp => rp.RoleId);

        modelBuilder.Entity<RolePermission>()
            .HasOne(rp => rp.Permission)
            .WithMany(p => p.RolePermissions)
            .HasForeignKey(rp => rp.PermissionId);

        // ── User ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<User>()
            .HasOne(u => u.Role)
            .WithMany(r => r.Users)
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.SetNull);

        // Unique constraint on email (also implicitly used for login lookups)
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // Filtered queries by suspension status are common in admin UIs
        modelBuilder.Entity<User>()
            .HasIndex(u => u.IsSuspended);

        // ── RefreshToken ──────────────────────────────────────────────────────
        modelBuilder.Entity<RefreshToken>()
            .HasOne(rt => rt.User)
            .WithMany()
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.UserId);

        // Unique index: token hashes must be globally unique for secure lookup
        modelBuilder.Entity<RefreshToken>()
            .HasIndex(rt => rt.TokenHash)
            .IsUnique();

        // ── ForgetPassword ────────────────────────────────────────────────────
        modelBuilder.Entity<ForgetPassword>()
            .HasOne(fp => fp.User)
            .WithMany()
            .HasForeignKey(fp => fp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Email lookups happen on every OTP verify / resend
        modelBuilder.Entity<ForgetPassword>()
            .HasIndex(fp => fp.Email);

        // UserId lookups happen on forgot-password upsert
        modelBuilder.Entity<ForgetPassword>()
            .HasIndex(fp => fp.UserId);

        // ── Role ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<Role>()
            .HasIndex(r => r.Name)
            .IsUnique();

        // ── Permission ────────────────────────────────────────────────────────
        modelBuilder.Entity<Permission>()
            .HasIndex(p => p.Name)
            .IsUnique();

        // ── Category ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Category>()
            .HasIndex(c => c.Name)
            .IsUnique();

        modelBuilder.Entity<Category>()
            .HasIndex(c => c.Status);

        // ── Brand ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Brand>()
            .HasIndex(b => b.Name)
            .IsUnique();

        modelBuilder.Entity<Brand>()
            .HasIndex(b => b.Status);

        // ── Unit ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<Unit>()
            .HasIndex(u => u.Title)
            .IsUnique();

        // ── Product ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Slug)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Sku)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Status);

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Quantity);

        modelBuilder.Entity<Product>()
            .Property(p => p.Price)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Product>()
            .Property(p => p.Discount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Product>()
            .Property(p => p.PurchasePrice)
            .HasColumnType("decimal(18,2)");

        // DiscountedPrice is computed — do not map to a column
        modelBuilder.Entity<Product>()
            .Ignore(p => p.DiscountedPrice);

        // ── Customer ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Customer>()
            .HasIndex(c => c.Phone)
            .IsUnique()
            .HasFilter("[Phone] IS NOT NULL");

        // ── Supplier ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Supplier>()
            .HasIndex(s => s.Phone)
            .IsUnique()
            .HasFilter("[Phone] IS NOT NULL");

        // SetNull on delete so products survive category/brand/unit removal
        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Brand)
            .WithMany(b => b.Products)
            .HasForeignKey(p => p.BrandId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Unit)
            .WithMany(u => u.Products)
            .HasForeignKey(p => p.UnitId)
            .OnDelete(DeleteBehavior.SetNull);

        // ── Sale ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<Sale>()
            .HasOne(o => o.Customer)
            .WithMany()
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Sale>()
            .HasOne(o => o.User)
            .WithMany()
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Sale>()
            .Property(o => o.SubTotal).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .Property(o => o.Discount).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .Property(o => o.Total).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .Property(o => o.Paid).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .Property(o => o.Due).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .Property(o => o.Change).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .Property(o => o.RoundedTotal).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .Property(o => o.RoundingAdjustment).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Sale>()
            .HasIndex(o => o.Status);

        modelBuilder.Entity<Sale>()
            .HasIndex(o => o.CustomerId);

        modelBuilder.Entity<Sale>()
            .HasIndex(o => o.CreatedAt);

        // Composite index for customer sale history queries
        modelBuilder.Entity<Sale>()
            .HasIndex(o => new { o.CustomerId, o.CreatedAt });

        // ── SaleItem ──────────────────────────────────────────────────────────
        modelBuilder.Entity<SaleItem>()
            .HasOne(oi => oi.Sale)
            .WithMany(o => o.SaleItems)
            .HasForeignKey(oi => oi.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        // NOTE: The SaleItem → Product FK is configured in the Stock Bundle section
        // below (ProductId is now nullable for bundle header rows).

        modelBuilder.Entity<SaleItem>()
            .Property(oi => oi.Price).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<SaleItem>()
            .Property(oi => oi.PurchasePrice).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<SaleItem>()
            .Property(oi => oi.SubTotal).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<SaleItem>()
            .Property(oi => oi.Discount).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<SaleItem>()
            .Property(oi => oi.Total).HasColumnType("decimal(18,2)");

        // ── SaleTransaction ───────────────────────────────────────────────────
        modelBuilder.Entity<SaleTransaction>()
            .HasOne(ot => ot.Sale)
            .WithMany(o => o.SaleTransactions)
            .HasForeignKey(ot => ot.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SaleTransaction>()
            .HasOne(ot => ot.Customer)
            .WithMany()
            .HasForeignKey(ot => ot.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SaleTransaction>()
            .HasOne(ot => ot.User)
            .WithMany()
            .HasForeignKey(ot => ot.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<SaleTransaction>()
            .Property(ot => ot.Amount).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<SaleTransaction>()
            .Property(ot => ot.Change).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<SaleTransaction>()
            .HasIndex(ot => ot.SaleId);

        // ── Purchase ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<Purchase>()
            .HasOne(p => p.Supplier)
            .WithMany()
            .HasForeignKey(p => p.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Purchase>()
            .HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Purchase>()
            .Property(p => p.SubTotal).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Purchase>()
            .Property(p => p.Tax).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Purchase>()
            .Property(p => p.Discount).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Purchase>()
            .Property(p => p.Shipping).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Purchase>()
            .Property(p => p.GrandTotal).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Purchase>()
            .Property(p => p.RoundedTotal).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Purchase>()
            .Property(p => p.RoundingAdjustment).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<Purchase>()
            .HasIndex(p => p.SupplierId);
        modelBuilder.Entity<Purchase>()
            .HasIndex(p => p.Date);

        // ── PurchaseItem ──────────────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseItem>()
            .HasOne(pi => pi.Purchase)
            .WithMany(p => p.PurchaseItems)
            .HasForeignKey(pi => pi.PurchaseId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PurchaseItem>()
            .HasOne(pi => pi.Product)
            .WithMany()
            .HasForeignKey(pi => pi.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PurchaseItem>()
            .Property(pi => pi.PurchasePrice).HasColumnType("decimal(18,2)");
        modelBuilder.Entity<PurchaseItem>()
            .Property(pi => pi.Price).HasColumnType("decimal(18,2)");

        // Indexes for PurchaseItem FK columns (EF Core does not auto-create FK indexes for SQLite)
        modelBuilder.Entity<PurchaseItem>()
            .HasIndex(pi => pi.PurchaseId);
        modelBuilder.Entity<PurchaseItem>()
            .HasIndex(pi => pi.ProductId);

        // ── PosCart ───────────────────────────────────────────────────────────
        modelBuilder.Entity<PosCart>()
            .HasOne(c => c.User)
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // NOTE: The PosCart → Product FK, bundle FK, and self-referencing FK are
        // configured in the Stock Bundle section below (ProductId is now nullable).
        // The old composite unique index (UserId + ProductId) has been removed
        // because bundle sub-items can have the same ProductId under different headers.

        // Fast per-user cart lookups
        modelBuilder.Entity<PosCart>()
            .HasIndex(c => c.UserId);

        // ── PaymentMethod ──────────────────────────────────────────────────────
        modelBuilder.Entity<PaymentMethod>()
            .HasIndex(pm => pm.Name)
            .IsUnique();

        modelBuilder.Entity<PaymentMethod>()
            .HasIndex(pm => pm.IsActive);

        // ── SaleTransaction → PaymentMethod ───────────────────────────────────
        modelBuilder.Entity<SaleTransaction>()
            .HasOne(ot => ot.PaymentMethod)
            .WithMany()
            .HasForeignKey(ot => ot.PaymentMethodId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<SaleTransaction>()
            .HasIndex(ot => ot.PaymentMethodId);

        // ── Purchase → PaymentMethod ───────────────────────────────────────────
        modelBuilder.Entity<Purchase>()
            .HasOne(p => p.PaymentMethod)
            .WithMany()
            .HasForeignKey(p => p.PaymentMethodId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Purchase>()
            .HasIndex(p => p.PaymentMethodId);

        // ── PurchaseTransaction ────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseTransaction>()
            .HasOne(pt => pt.Purchase)
            .WithMany(p => p.PurchaseTransactions)
            .HasForeignKey(pt => pt.PurchaseId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PurchaseTransaction>()
            .HasOne(pt => pt.Supplier)
            .WithMany()
            .HasForeignKey(pt => pt.SupplierId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PurchaseTransaction>()
            .HasOne(pt => pt.User)
            .WithMany()
            .HasForeignKey(pt => pt.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<PurchaseTransaction>()
            .HasOne(pt => pt.PaymentMethod)
            .WithMany()
            .HasForeignKey(pt => pt.PaymentMethodId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<PurchaseTransaction>()
            .Property(pt => pt.Amount).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<PurchaseTransaction>()
            .HasIndex(pt => pt.PurchaseId);

        modelBuilder.Entity<PurchaseTransaction>()
            .HasIndex(pt => pt.SupplierId);

        // Purchase.AmountPaid and Purchase.AmountDue
        modelBuilder.Entity<Purchase>()
            .Property(p => p.AmountPaid).HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Purchase>()
            .Property(p => p.AmountDue).HasColumnType("decimal(18,2)");

        // ── Currency ───────────────────────────────────────────────────────────
        // ISO code must be unique (e.g. only one "USD" row)
        modelBuilder.Entity<Currency>()
            .HasIndex(c => c.Code)
            .IsUnique();

        // Fast lookup for the single active/default currency
        modelBuilder.Entity<Currency>()
            .HasIndex(c => c.Active);

        // ── Setting ────────────────────────────────────────────────────────────
        // Keys must be globally unique so upserts can safely use FirstOrDefault on Key
        modelBuilder.Entity<Setting>()
            .HasIndex(s => s.Key)
            .IsUnique();

        // Allow efficient filtering by group (e.g. load all "invoice" settings)
        modelBuilder.Entity<Setting>()
            .HasIndex(s => s.Group);

        // ── Module 15: Stock Assembly ──────────────────────────────────────────

        // Product → AutoAssemblyTemplate: optional FK, SetNull if template is deleted
        modelBuilder.Entity<Product>()
            .HasOne(p => p.AutoAssemblyTemplate)
            .WithMany()
            .HasForeignKey(p => p.AutoAssemblyTemplateId)
            .OnDelete(DeleteBehavior.SetNull);

        // ── AssemblyTemplate ──────────────────────────────────────────────────
        modelBuilder.Entity<AssemblyTemplate>()
            .HasOne(t => t.OutputProduct)
            .WithMany()
            .HasForeignKey(t => t.OutputProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AssemblyTemplate>()
            .HasIndex(t => t.IsActive);

        modelBuilder.Entity<AssemblyTemplate>()
            .HasIndex(t => t.OutputProductId);

        modelBuilder.Entity<AssemblyTemplate>()
            .Property(t => t.DefaultYield)
            .HasColumnType("decimal(18,2)");

        // ── AssemblyTemplateItem ──────────────────────────────────────────────
        modelBuilder.Entity<AssemblyTemplateItem>()
            .HasOne(i => i.AssemblyTemplate)
            .WithMany(t => t.Items)
            .HasForeignKey(i => i.AssemblyTemplateId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AssemblyTemplateItem>()
            .HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AssemblyTemplateItem>()
            .Property(i => i.DefaultQuantity)
            .HasColumnType("decimal(18,4)");

        modelBuilder.Entity<AssemblyTemplateItem>()
            .HasIndex(i => i.AssemblyTemplateId);

        // ── StockAssembly ─────────────────────────────────────────────────────
        modelBuilder.Entity<StockAssembly>()
            .HasOne(a => a.AssemblyTemplate)
            .WithMany(t => t.Assemblies)
            .HasForeignKey(a => a.AssemblyTemplateId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<StockAssembly>()
            .HasOne(a => a.OutputProduct)
            .WithMany()
            .HasForeignKey(a => a.OutputProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StockAssembly>()
            .HasOne(a => a.Purchase)
            .WithMany()
            .HasForeignKey(a => a.PurchaseId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<StockAssembly>()
            .HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<StockAssembly>()
            .Property(a => a.OutputQuantity)
            .HasColumnType("decimal(18,4)");

        modelBuilder.Entity<StockAssembly>()
            .Property(a => a.OutputCostPerUnit)
            .HasColumnType("decimal(18,4)");

        // Indexes for common filter/lookup patterns
        modelBuilder.Entity<StockAssembly>()
            .HasIndex(a => a.OutputProductId);

        modelBuilder.Entity<StockAssembly>()
            .HasIndex(a => a.AssembledAt);

        modelBuilder.Entity<StockAssembly>()
            .HasIndex(a => a.AssemblyType);

        modelBuilder.Entity<StockAssembly>()
            .HasIndex(a => a.TriggeredBy);

        // ── StockAssemblyItem ─────────────────────────────────────────────────
        modelBuilder.Entity<StockAssemblyItem>()
            .HasOne(i => i.StockAssembly)
            .WithMany(a => a.Items)
            .HasForeignKey(i => i.StockAssemblyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<StockAssemblyItem>()
            .HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<StockAssemblyItem>()
            .Property(i => i.QuantityUsed)
            .HasColumnType("decimal(18,4)");

        modelBuilder.Entity<StockAssemblyItem>()
            .Property(i => i.WasteQuantity)
            .HasColumnType("decimal(18,4)");

        modelBuilder.Entity<StockAssemblyItem>()
            .Property(i => i.UnitCostAtTime)
            .HasColumnType("decimal(18,4)");

        modelBuilder.Entity<StockAssemblyItem>()
            .HasIndex(i => i.StockAssemblyId);

        // ── AuditLog ──────────────────────────────────────────────────────────
        // Preserve logs even if the user who performed the action is deleted.
        modelBuilder.Entity<AuditLog>()
            .HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Index on UserId for "show all actions by user X" queries
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.UserId);

        // Composite index for filtering by entity type + entity id
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => new { a.EntityType, a.EntityId });

        // Chronological range queries (most common admin view)
        modelBuilder.Entity<AuditLog>()
            .HasIndex(a => a.CreatedAt);

        // ── ProductBundle ─────────────────────────────────────────────────────
        modelBuilder.Entity<ProductBundle>()
            .Property(b => b.Price)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<ProductBundle>()
            .HasIndex(b => b.IsActive);

        // HasSteps is computed — do not map to a column
        modelBuilder.Entity<ProductBundle>()
            .Ignore(b => b.HasSteps);

        // ── BundleStep ──────────────────────────────────────────────────────
        // Cascade delete: removing a bundle removes all its steps.
        modelBuilder.Entity<BundleStep>()
            .HasOne(s => s.ProductBundle)
            .WithMany(b => b.Steps)
            .HasForeignKey(s => s.ProductBundleId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BundleStep>()
            .HasIndex(s => s.ProductBundleId);

        // Unique composite: one SortOrder per bundle
        modelBuilder.Entity<BundleStep>()
            .HasIndex(s => new { s.ProductBundleId, s.SortOrder })
            .IsUnique();

        modelBuilder.Entity<BundleStep>()
            .Property(s => s.Label)
            .HasMaxLength(200);

        // ── BundleStepProduct ───────────────────────────────────────────────
        // Cascade delete: removing a step removes all its product assignments.
        modelBuilder.Entity<BundleStepProduct>()
            .HasOne(sp => sp.BundleStep)
            .WithMany(s => s.StepProducts)
            .HasForeignKey(sp => sp.BundleStepId)
            .OnDelete(DeleteBehavior.Cascade);

        // Cascade delete: removing a product removes it from step eligibility lists.
        modelBuilder.Entity<BundleStepProduct>()
            .HasOne(sp => sp.Product)
            .WithMany()
            .HasForeignKey(sp => sp.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BundleStepProduct>()
            .HasIndex(sp => sp.BundleStepId);

        // Unique composite: one product per step
        modelBuilder.Entity<BundleStepProduct>()
            .HasIndex(sp => new { sp.BundleStepId, sp.ProductId })
            .IsUnique();

        // ── SaleItem — bundle columns ─────────────────────────────────────────
        // ProductId is now nullable (bundle header rows have no product).
        // Re-declare the Product FK with the updated nullability and no-cascade
        // (products should survive sale item deletion).
        modelBuilder.Entity<SaleItem>()
            .HasOne(si => si.Product)
            .WithMany()
            .HasForeignKey(si => si.ProductId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        // Self-referencing FK: sub-items → their header item.
        // Cascade delete: when a bundle header SaleItem is deleted, its sub-items
        // go too (handled by this cascade relationship).
        modelBuilder.Entity<SaleItem>()
            .HasOne(si => si.BundleHeaderSaleItem)
            .WithMany()
            .HasForeignKey(si => si.BundleHeaderSaleItemId)
            .OnDelete(DeleteBehavior.NoAction)
            .IsRequired(false);

        // FK to the bundle definition (for audit/lookup — header rows only).
        modelBuilder.Entity<SaleItem>()
            .HasOne(si => si.ProductBundle)
            .WithMany(b => b.HeaderItems)
            .HasForeignKey(si => si.ProductBundleId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        modelBuilder.Entity<SaleItem>()
            .HasIndex(si => si.BundleHeaderSaleItemId);

        modelBuilder.Entity<SaleItem>()
            .HasIndex(si => si.ProductBundleId);

        // FK: SaleItem → BundleStep (multi-step bundle sub-items)
        // NoAction: steps are deleted via delete-and-recreate in ProductBundleService;
        // SaleItems are historical records and retain null BundleStepId if step removed.
        modelBuilder.Entity<SaleItem>()
            .HasOne(si => si.BundleStep)
            .WithMany()
            .HasForeignKey(si => si.BundleStepId)
            .OnDelete(DeleteBehavior.NoAction)
            .IsRequired(false);

        // ── PosCart — bundle columns ──────────────────────────────────────────
        // ProductId is now nullable (bundle header rows have no product).
        // Drop the old composite unique index (UserId + ProductId) because it
        // no longer applies: bundle sub-items with the same ProductId may appear
        // multiple times under different bundle headers.
        // Re-declare the Product FK as optional.
        modelBuilder.Entity<PosCart>()
            .HasOne(c => c.Product)
            .WithMany()
            .HasForeignKey(c => c.ProductId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        // Self-referencing FK: bundle sub-item cart rows → their header cart row.
        // No cascade here — ClearAsync removes everything anyway.
        modelBuilder.Entity<PosCart>()
            .HasOne(c => c.BundleHeaderPosCart)
            .WithMany()
            .HasForeignKey(c => c.BundleHeaderPosCartId)
            .OnDelete(DeleteBehavior.NoAction)
            .IsRequired(false);

        // FK to the bundle definition (header rows only).
        modelBuilder.Entity<PosCart>()
            .HasOne(c => c.ProductBundle)
            .WithMany()
            .HasForeignKey(c => c.ProductBundleId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        modelBuilder.Entity<PosCart>()
            .HasIndex(c => c.BundleHeaderPosCartId);

        // FK: PosCart → BundleStep (multi-step bundle sub-items)
        // NoAction: cart is cleared on POS mount; avoids SQL Server cascade-path conflict.
        modelBuilder.Entity<PosCart>()
            .HasOne(c => c.BundleStep)
            .WithMany()
            .HasForeignKey(c => c.BundleStepId)
            .OnDelete(DeleteBehavior.NoAction)
            .IsRequired(false);

        // ── SaleItem — Phase 3 kitchen/restaurant columns ─────────────────────
        modelBuilder.Entity<SaleItem>()
            .Property(si => si.ModifierNote)
            .HasMaxLength(500);

        modelBuilder.Entity<SaleItem>()
            .Property(si => si.ItemDiscountType)
            .HasMaxLength(20);

        modelBuilder.Entity<SaleItem>()
            .Property(si => si.ItemDiscount)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<SaleItem>()
            .Property(si => si.OverriddenPrice)
            .HasColumnType("decimal(18,2)");

        // FK: VoidedByUser — SetNull so SaleItem survives user deletion
        modelBuilder.Entity<SaleItem>()
            .HasOne(si => si.VoidedByUser)
            .WithMany()
            .HasForeignKey(si => si.VoidedByUserId)
            .OnDelete(DeleteBehavior.SetNull)
            .IsRequired(false);

        // ── Sale — Phase 3 discount/voucher columns ────────────────────────────
        modelBuilder.Entity<Sale>()
            .Property(s => s.DiscountType)
            .HasMaxLength(20);

        modelBuilder.Entity<Sale>()
            .Property(s => s.VoucherCode)
            .HasMaxLength(100);

        // ── RestaurantTable ────────────────────────────────────────────────────
        modelBuilder.Entity<RestaurantTable>()
            .Property(t => t.Status)
            .HasMaxLength(20);

        // Fast lookup for the floor-plan view (filter by active + status)
        modelBuilder.Entity<RestaurantTable>()
            .HasIndex(t => t.IsActive);

        modelBuilder.Entity<RestaurantTable>()
            .HasIndex(t => t.Status);

        // ── Sale → RestaurantTable FK ──────────────────────────────────────────
        // SetNull: deleting a table does not cascade-delete its historical sales.
        modelBuilder.Entity<Sale>()
            .HasOne(s => s.Table)
            .WithMany(t => t.Sales)
            .HasForeignKey(s => s.TableId)
            .OnDelete(DeleteBehavior.SetNull);

        // Index for fast "which table does this sale belong to?" and
        // "show all open sales for a given table" lookups
        modelBuilder.Entity<Sale>()
            .HasIndex(s => s.TableId);

        // ── Sale — restaurant string columns ──────────────────────────────────
        modelBuilder.Entity<Sale>()
            .Property(s => s.OrderType)
            .HasMaxLength(20)
            .HasDefaultValue(OrderTypes.Pos);

        modelBuilder.Entity<Sale>()
            .Property(s => s.OrderStatus)
            .HasMaxLength(20)
            .HasDefaultValue(OrderStatuses.Paid);

        modelBuilder.Entity<Sale>()
            .Property(s => s.TakeawayCharge)
            .HasColumnType("decimal(18,2)");

        // Index for filtering open dine-in orders (Phase 3 will use this heavily)
        modelBuilder.Entity<Sale>()
            .HasIndex(s => s.OrderStatus);

        // ── Product — Phase 4 new column ───────────────────────────────────────
        modelBuilder.Entity<Product>()
            .Property(p => p.ProductType)
            .HasMaxLength(20)
            .HasDefaultValue(ProductTypes.Standard);

        // ── ProductModifierGroup ───────────────────────────────────────────────
        // Cascade delete: removing a product removes all its modifier groups and options.
        modelBuilder.Entity<ProductModifierGroup>()
            .HasOne(g => g.Product)
            .WithMany(p => p.ModifierGroups)
            .HasForeignKey(g => g.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductModifierGroup>()
            .Property(g => g.Name)
            .HasMaxLength(200);

        // Composite index: fast lookup for "all active groups for product X"
        modelBuilder.Entity<ProductModifierGroup>()
            .HasIndex(g => new { g.ProductId, g.IsActive });

        // ── ProductModifierOption ──────────────────────────────────────────────
        // Cascade delete: removing a group removes all its options.
        modelBuilder.Entity<ProductModifierOption>()
            .HasOne(o => o.ModifierGroup)
            .WithMany(g => g.Options)
            .HasForeignKey(o => o.ModifierGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ProductModifierOption>()
            .Property(o => o.Name)
            .HasMaxLength(200);

        modelBuilder.Entity<ProductModifierOption>()
            .Property(o => o.PriceAdjustment)
            .HasColumnType("decimal(18,2)");

        // ── ComboItem ──────────────────────────────────────────────────────────
        // ComboProductId FK: cascade delete (if the combo product is removed, its definitions go too).
        modelBuilder.Entity<ComboItem>()
            .HasOne(c => c.ComboProduct)
            .WithMany(p => p.ComboItems)
            .HasForeignKey(c => c.ComboProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // ComponentProductId FK: restrict — do not allow deleting a product while it is
        // still referenced as a combo component (admin must remove it from combos first).
        modelBuilder.Entity<ComboItem>()
            .HasOne(c => c.ComponentProduct)
            .WithMany()
            .HasForeignKey(c => c.ComponentProductId)
            .OnDelete(DeleteBehavior.Restrict);

        // Unique constraint: one component can only appear once per combo product.
        modelBuilder.Entity<ComboItem>()
            .HasIndex(c => new { c.ComboProductId, c.ComponentProductId })
            .IsUnique();

        modelBuilder.Entity<ComboItem>()
            .Property(c => c.Quantity)
            .HasColumnType("decimal(18,4)");

        // ── VoucherPackage ─────────────────────────────────────────────────────
        modelBuilder.Entity<VoucherPackage>()
            .HasIndex(v => v.Code)
            .IsUnique();

        modelBuilder.Entity<VoucherPackage>()
            .Property(v => v.DiscountValue)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<VoucherPackage>()
            .HasIndex(v => v.IsActive);

        // ── VoucherPackageItem ─────────────────────────────────────────────────
        modelBuilder.Entity<VoucherPackageItem>()
            .HasIndex(i => new { i.VoucherPackageId, i.ProductId })
            .IsUnique();

        modelBuilder.Entity<VoucherPackageItem>()
            .HasOne(i => i.VoucherPackage)
            .WithMany(v => v.Items)
            .HasForeignKey(i => i.VoucherPackageId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<VoucherPackageItem>()
            .HasOne(i => i.Product)
            .WithMany()
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<VoucherPackageItem>()
            .Property(i => i.OverridePrice)
            .HasColumnType("decimal(18,2)");

        // ── TableMerge ─────────────────────────────────────────────────────────
        modelBuilder.Entity<TableMerge>()
            .HasOne(m => m.PrimarySale)
            .WithMany()
            .HasForeignKey(m => m.PrimarySaleId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TableMerge>()
            .HasOne(m => m.AbsorbedTable)
            .WithMany()
            .HasForeignKey(m => m.AbsorbedTableId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TableMerge>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(m => m.MergedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // AbsorbedSale FK: NoAction — SQL Server disallows SetNull here due to multiple cascade paths from Sales.
        modelBuilder.Entity<TableMerge>()
            .HasOne(m => m.AbsorbedSale)
            .WithMany()
            .HasForeignKey(m => m.AbsorbedSaleId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<TableMerge>()
            .HasIndex(m => m.PrimarySaleId);

        modelBuilder.Entity<TableMerge>()
            .HasIndex(m => m.AbsorbedSaleId);
    }
}
