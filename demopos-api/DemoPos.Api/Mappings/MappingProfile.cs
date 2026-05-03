using AutoMapper;
using DemoPos.Api.DTOs.Categories;
using DemoPos.Api.DTOs.Brands;
using DemoPos.Api.DTOs.Units;
using DemoPos.Api.DTOs.Products;
using DemoPos.Api.DTOs.Customers;
using DemoPos.Api.DTOs.Suppliers;
using DemoPos.Api.DTOs.Sales;
using DemoPos.Api.DTOs.Purchases;
using DemoPos.Api.DTOs.PaymentMethods;
using DemoPos.Api.DTOs.Currencies;
using DemoPos.Api.DTOs.Permissions;
using DemoPos.Api.DTOs.Roles;
using DemoPos.Api.DTOs.Users;
using DemoPos.Api.DTOs.Assembly;
using DemoPos.Api.DTOs.Combo;
using DemoPos.Api.DTOs.Modifier;
using DemoPos.Api.DTOs.ProductBundle;
using DemoPos.Api.DTOs.RestaurantTable;
using DemoPos.Api.DTOs.Voucher;
using DemoPos.Api.Models;

namespace DemoPos.Api.Mappings;

/// <summary>
/// Central AutoMapper profile for the DemoPos API.
/// All <c>CreateMap</c> declarations live here so every mapping is visible in
/// one place and the profile can be scanned by a single assembly reference in
/// Program.cs.
/// </summary>
public sealed class MappingProfile : Profile
{
    public MappingProfile()
    {
        // ── User → UserDto ────────────────────────────────────────────────────
        // User.Role is a Role navigation property; UserDto.Role is a string?
        // that carries only the role name.  The standard name-matching cannot
        // resolve this automatically, so we use ForMember to flatten it.
        // Permissions are collected from the RolePermissions join-table chain.
        // When the navigation is not loaded the collections will be empty and
        // the projection returns an empty list, which is safe.
        CreateMap<User, UserDto>()
            .ForMember(dest => dest.Role,
                opt => opt.MapFrom(src => src.Role != null ? src.Role.Name : null))
            .ForMember(dest => dest.Permissions,
                opt => opt.MapFrom(src => src.Role != null
                    ? src.Role.RolePermissions.Select(rp => rp.Permission.Name).ToList()
                    : new List<string>()));

        // ── Role → RoleDto ────────────────────────────────────────────────────
        // Flatten the RolePermissions join-table into a flat list of permission
        // name strings so callers never need to traverse two levels of nesting.
        CreateMap<Role, RoleDto>()
            .ForMember(dest => dest.Permissions,
                opt => opt.MapFrom(src =>
                    src.RolePermissions.Select(rp => rp.Permission.Name).ToList()));

        // ── Permission → PermissionDto ────────────────────────────────────────
        // All scalar members match by convention; no custom ForMember needed.
        CreateMap<Permission, PermissionDto>();

        // ── Category → CategoryDto ────────────────────────────────────────────
        CreateMap<Category, CategoryDto>();

        // ── Brand → BrandDto ──────────────────────────────────────────────────
        CreateMap<Brand, BrandDto>();

        // ── Unit → UnitDto ────────────────────────────────────────────────────
        CreateMap<Unit, UnitDto>();

        // ── Customer → CustomerDto ────────────────────────────────────────────
        CreateMap<Customer, CustomerDto>();

        // ── Supplier → SupplierDto ────────────────────────────────────────────
        CreateMap<Supplier, SupplierDto>();

        // ── Product → ProductDto ──────────────────────────────────────────────
        CreateMap<Product, ProductDto>()
            .ForMember(dest => dest.CategoryName,
                opt => opt.MapFrom(src => src.Category != null ? src.Category.Name : null))
            .ForMember(dest => dest.BrandName,
                opt => opt.MapFrom(src => src.Brand != null ? src.Brand.Name : null))
            .ForMember(dest => dest.UnitShortName,
                opt => opt.MapFrom(src => src.Unit != null ? src.Unit.ShortName : null))
            .ForMember(dest => dest.DiscountedPrice,
                opt => opt.MapFrom(src => src.DiscountedPrice));

        // ── Sale → SaleSummaryDto ─────────────────────────────────────────────
        // CustomerName is flattened from the Customer navigation property.
        // StatusLabel is computed: 1 = "Paid", anything else = "Due".
        // TableNumber and TableLabel are flattened from the Table navigation.
        CreateMap<Sale, SaleSummaryDto>()
            .ForMember(dest => dest.CustomerName,
                opt => opt.MapFrom(src => src.Customer != null ? src.Customer.Name : string.Empty))
            .ForMember(dest => dest.StatusLabel,
                opt => opt.MapFrom(src => src.Status == 1 ? "Paid" : "Due"))
            .ForMember(dest => dest.TableNumber,
                opt => opt.MapFrom(src => src.Table != null ? src.Table.Number.ToString() : null))
            .ForMember(dest => dest.TableLabel,
                opt => opt.MapFrom(src => src.Table != null ? src.Table.Label : null));

        // ── Sale → SaleDetailDto ──────────────────────────────────────────────
        // Inherits all SaleSummaryDto mappings via IncludeBase.
        // Items and Transactions map by convention from the navigation collections.
        CreateMap<Sale, SaleDetailDto>()
            .IncludeBase<Sale, SaleSummaryDto>()
            .ForMember(dest => dest.UserName,
                opt => opt.MapFrom(src => src.User != null ? src.User.Name : null))
            .ForMember(dest => dest.Items,
                opt => opt.MapFrom(src => src.SaleItems))
            .ForMember(dest => dest.Transactions,
                opt => opt.MapFrom(src => src.SaleTransactions));

        // ── SaleItem → SaleItemDto ────────────────────────────────────────────
        // ProductId is now nullable (bundle header rows have no product).
        // All scalar fields including kitchen/restaurant fields map by convention.
        CreateMap<SaleItem, SaleItemDto>()
            .ForMember(dest => dest.ProductName,
                opt => opt.MapFrom(src => src.Product != null
                    ? src.Product.Name
                    : src.ProductBundle != null
                        ? src.ProductBundle.Name
                        : string.Empty))
            .ForMember(dest => dest.ProductSku,
                opt => opt.MapFrom(src => src.Product != null ? src.Product.Sku : null))
            .ForMember(dest => dest.BundleStepLabel,
                opt => opt.MapFrom(src => src.BundleStep != null ? src.BundleStep.Label : null));

        // ── SaleTransaction → SaleTransactionDto ─────────────────────────────
        CreateMap<SaleTransaction, SaleTransactionDto>()
            .ForMember(dest => dest.UserName,
                opt => opt.MapFrom(src => src.User != null ? src.User.Name : null))
            .ForMember(dest => dest.PaymentMethodName,
                opt => opt.MapFrom(src => src.PaymentMethod != null ? src.PaymentMethod.Name : null));

        // ── Purchase → PurchaseSummaryDto ─────────────────────────────────────────
        // SupplierName is flattened from the Supplier navigation property.
        // PaymentMethodName is flattened from the optional PaymentMethod navigation.
        CreateMap<Purchase, PurchaseSummaryDto>()
            .ForMember(dest => dest.SupplierName,
                opt => opt.MapFrom(src => src.Supplier != null ? src.Supplier.Name : string.Empty))
            .ForMember(dest => dest.PaymentMethodName,
                opt => opt.MapFrom(src => src.PaymentMethod != null ? src.PaymentMethod.Name : null));

        // ── Purchase → PurchaseDetailDto ──────────────────────────────────────────
        // Inherits PurchaseSummaryDto mappings (SupplierName) via IncludeBase.
        // Items maps from the PurchaseItems navigation collection.
        CreateMap<Purchase, PurchaseDetailDto>()
            .IncludeBase<Purchase, PurchaseSummaryDto>()
            .ForMember(dest => dest.Items,
                opt => opt.MapFrom(src => src.PurchaseItems));

        // ── PurchaseItem → PurchaseItemDto ────────────────────────────────────────
        // RowTotal is computed (PurchasePrice * Quantity) — not stored in DB.
        CreateMap<PurchaseItem, PurchaseItemDto>()
            .ForMember(dest => dest.ProductName,
                opt => opt.MapFrom(src => src.Product != null ? src.Product.Name : string.Empty))
            .ForMember(dest => dest.RowTotal,
                opt => opt.MapFrom(src => src.PurchasePrice * src.Quantity));

        // ── PaymentMethod → PaymentMethodDto ─────────────────────────────────────
        // All scalar members match by convention; no custom ForMember needed.
        CreateMap<PaymentMethod, PaymentMethodDto>();

        // ── Currency → CurrencyDto ────────────────────────────────────────────
        // All scalar members match by convention; no custom ForMember needed.
        CreateMap<Currency, CurrencyDto>();

        // ── AssemblyTemplate → AssemblyTemplateSummaryDto ─────────────────────
        // Flatten OutputProduct navigation to OutputProductName scalar.
        // ItemCount is derived from the Items collection count.
        CreateMap<AssemblyTemplate, AssemblyTemplateSummaryDto>()
            .ForMember(dest => dest.OutputProductName,
                opt => opt.MapFrom(src => src.OutputProduct != null ? src.OutputProduct.Name : null))
            .ForMember(dest => dest.ItemCount,
                opt => opt.MapFrom(src => src.Items != null ? src.Items.Count : 0));

        // ── AssemblyTemplate → AssemblyTemplateDetailDto ─────────────────────
        // Inherits summary mappings via IncludeBase; Items maps from navigation.
        CreateMap<AssemblyTemplate, AssemblyTemplateDetailDto>()
            .IncludeBase<AssemblyTemplate, AssemblyTemplateSummaryDto>()
            .ForMember(dest => dest.Items,
                opt => opt.MapFrom(src => src.Items));

        // ── AssemblyTemplateItem → AssemblyTemplateItemDto ────────────────────
        CreateMap<AssemblyTemplateItem, AssemblyTemplateItemDto>()
            .ForMember(dest => dest.ProductName,
                opt => opt.MapFrom(src => src.Product != null ? src.Product.Name : null));

        // ── StockAssembly → StockAssemblySummaryDto ───────────────────────────
        CreateMap<StockAssembly, StockAssemblySummaryDto>()
            .ForMember(dest => dest.OutputProductName,
                opt => opt.MapFrom(src => src.OutputProduct != null ? src.OutputProduct.Name : null))
            .ForMember(dest => dest.UserName,
                opt => opt.MapFrom(src => src.User != null ? src.User.Name : null));

        // ── StockAssembly → StockAssemblyDetailDto ────────────────────────────
        CreateMap<StockAssembly, StockAssemblyDetailDto>()
            .IncludeBase<StockAssembly, StockAssemblySummaryDto>()
            .ForMember(dest => dest.TemplateName,
                opt => opt.MapFrom(src => src.AssemblyTemplate != null ? src.AssemblyTemplate.Name : null))
            .ForMember(dest => dest.Items,
                opt => opt.MapFrom(src => src.Items));

        // ── StockAssemblyItem → StockAssemblyItemDto ──────────────────────────
        // TotalDeducted and LineCost are computed from persisted fields.
        CreateMap<StockAssemblyItem, StockAssemblyItemDto>()
            .ForMember(dest => dest.ProductName,
                opt => opt.MapFrom(src => src.Product != null ? src.Product.Name : null))
            .ForMember(dest => dest.TotalDeducted,
                opt => opt.MapFrom(src => src.QuantityUsed + src.WasteQuantity))
            .ForMember(dest => dest.LineCost,
                opt => opt.MapFrom(src => (src.QuantityUsed + src.WasteQuantity) * src.UnitCostAtTime));

        // ── ProductBundle → ProductBundleDto ──────────────────────────────────
        // HasSteps is computed from the Steps navigation.
        // Steps maps by convention from the Steps navigation collection.
        CreateMap<ProductBundle, ProductBundleDto>()
            .ForMember(dest => dest.HasSteps,
                opt => opt.MapFrom(src => src.HasSteps))
            .ForMember(dest => dest.Steps,
                opt => opt.MapFrom(src => src.Steps));

        // ── BundleStep → BundleStepDto ──────────────────────────────────────
        // Products maps from the StepProducts navigation (name differs).
        CreateMap<BundleStep, BundleStepDto>()
            .ForMember(dest => dest.Products,
                opt => opt.MapFrom(src => src.StepProducts));

        // ── BundleStepProduct → BundleStepProductDto ────────────────────────
        // Flatten Product navigation to scalar fields.
        CreateMap<BundleStepProduct, BundleStepProductDto>()
            .ForMember(dest => dest.ProductName,
                opt => opt.MapFrom(src => src.Product.Name))
            .ForMember(dest => dest.ProductImage,
                opt => opt.MapFrom(src => src.Product.Image))
            .ForMember(dest => dest.StockQuantity,
                opt => opt.MapFrom(src => src.Product.Quantity))
            .ForMember(dest => dest.Price,
                opt => opt.MapFrom(src => src.Product.DiscountedPrice));

        // ── RestaurantTable → RestaurantTableDto ──────────────────────────────
        // All scalar members match by convention; no custom ForMember needed.
        CreateMap<RestaurantTable, RestaurantTableDto>();

        // ── ProductModifierGroup → ModifierGroupDto ────────────────────────────
        // Options maps by convention from the Options navigation collection.
        CreateMap<ProductModifierGroup, ModifierGroupDto>();

        // ── ProductModifierOption → ModifierOptionDto ──────────────────────────
        // All scalar members match by convention; no custom ForMember needed.
        CreateMap<ProductModifierOption, ModifierOptionDto>();

        // ── ComboItem → ComboItemDto ───────────────────────────────────────────
        // ComponentProductName is flattened from the ComponentProduct navigation.
        CreateMap<ComboItem, ComboItemDto>()
            .ForMember(dest => dest.ComponentProductName,
                opt => opt.MapFrom(src => src.ComponentProduct != null ? src.ComponentProduct.Name : string.Empty));

        // ── VoucherPackage → VoucherPackageDto ────────────────────────────────
        CreateMap<VoucherPackage, VoucherPackageDto>();

        // ── VoucherPackageItem → VoucherPackageItemDto ────────────────────────
        CreateMap<VoucherPackageItem, VoucherPackageItemDto>()
            .ForMember(dest => dest.ProductName,
                opt => opt.MapFrom(src => src.Product != null ? src.Product.Name : string.Empty));
    }
}
